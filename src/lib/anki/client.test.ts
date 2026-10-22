import { describe, expect, it, vi } from 'vitest'
import { addAcceptedAnswer, appendAlternative, guessMapping, loadDueCards, previewDeck, toStudyCard } from './cards'
import { AnkiConnectClient, AnkiError, type CardInfo, deckQuery } from './client'

type Handler = (action: string, params: Record<string, unknown> | undefined) => unknown

/** A fake AnkiConnect: records every request and answers like the real add-on. */
function fakeAnki(handler: Handler) {
  const calls: Array<{ action: string; params?: Record<string, unknown>; key?: string }> = []
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    expect(body.version).toBe(6)
    calls.push({ action: body.action, params: body.params, key: body.key })
    try {
      return new Response(JSON.stringify({ result: handler(body.action, body.params), error: null }))
    } catch (error) {
      return new Response(JSON.stringify({ result: null, error: (error as Error).message }))
    }
  })
  return { fetch: fetchMock as unknown as typeof fetch, calls, fetchMock }
}

const info = (cardId: number, fields: Record<string, string>): CardInfo => ({
  cardId,
  note: cardId * 10,
  deckName: 'English',
  modelName: 'Basic',
  fields: Object.fromEntries(Object.entries(fields).map(([name, value], order) => [name, { value, order }])),
})

describe('AnkiConnectClient', () => {
  it('sends AnkiConnect v6 requests and returns the result', async () => {
    const anki = fakeAnki((action) => (action === 'deckNames' ? ['English', 'Default'] : null))
    const client = new AnkiConnectClient({ fetch: anki.fetch, apiKey: 'secret' })
    await expect(client.deckNames()).resolves.toEqual(['English', 'Default'])
    expect(anki.calls[0]).toEqual({ action: 'deckNames', params: undefined, key: 'secret' })
    expect(anki.fetchMock.mock.calls[0][0]).toBe('http://localhost:8765')
  })

  it('turns AnkiConnect error messages into typed errors', async () => {
    const anki = fakeAnki((action) => {
      if (action === 'answerCards') throw new Error('unsupported action')
      throw new Error('valid api key must be provided')
    })
    const client = new AnkiConnectClient({ fetch: anki.fetch })
    await expect(client.answerCards([{ cardId: 1, ease: 3 }])).rejects.toMatchObject({ code: 'outdated' })
    await expect(client.deckNames()).rejects.toMatchObject({ code: 'apiKey' })
  })

  it('reports "unreachable" when nothing answers (Anki closed)', async () => {
    const client = new AnkiConnectClient({
      fetch: (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch,
    })
    const error = await client.checkConnection().catch((e) => e)
    expect(error).toBeInstanceOf(AnkiError)
    expect(error.code).toBe('unreachable')
  })

  it('reports "forbidden" when Anki answers requestPermission but blocks this origin', async () => {
    // requestPermission is open to every origin; the next call fails like a CORS refusal.
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const { action } = JSON.parse(String(init?.body))
      if (action === 'requestPermission') {
        return new Response(JSON.stringify({ result: { permission: 'granted', version: 6 }, error: null }))
      }
      throw new TypeError('Failed to fetch')
    })
    const client = new AnkiConnectClient({ fetch: fetchMock as unknown as typeof fetch })
    await expect(client.checkConnection()).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('reports "forbidden" when the user clicks "No" in Anki', async () => {
    const anki = fakeAnki(() => ({ permission: 'denied' }))
    await expect(new AnkiConnectClient({ fetch: anki.fetch }).checkConnection()).rejects.toMatchObject({
      code: 'forbidden',
    })
  })

  it('returns version and sorted decks when everything is fine', async () => {
    const anki = fakeAnki((action) => {
      if (action === 'requestPermission') return { permission: 'granted', requireApikey: false, version: 6 }
      if (action === 'version') return 6
      if (action === 'deckNames') return ['Japanese', 'English']
    })
    await expect(new AnkiConnectClient({ fetch: anki.fetch }).checkConnection()).resolves.toEqual({
      version: 6,
      decks: ['English', 'Japanese'],
    })
  })

  it('sends grades with answerCards', async () => {
    const anki = fakeAnki((_action, params) => (params?.answers as unknown[]).map(() => true))
    const client = new AnkiConnectClient({ fetch: anki.fetch })
    await expect(client.answerCards([{ cardId: 42, ease: 2 }])).resolves.toEqual([true])
    expect(anki.calls[0]).toMatchObject({ action: 'answerCards', params: { answers: [{ cardId: 42, ease: 2 }] } })
  })

  it('quotes deck names for Anki search', () => {
    expect(deckQuery('Anglais::Lycée "B2"')).toBe('deck:"Anglais::Lycée \\"B2\\""')
  })
})

describe('cards', () => {
  const mapping = { english: 'Front', french: 'Back', example: 'Example', kind: 'Type' }

  it('maps fields to a clean study card', () => {
    const card = toStudyCard(
      info(7, { Front: '<b>to borrow</b>', Back: 'emprunter', Example: 'Can I borrow it?', Type: 'Vocabulaire' }),
      mapping,
    )
    expect(card).toEqual({ id: 7, english: 'to borrow', french: 'emprunter', example: 'Can I borrow it?', kind: 'vocabulary' })
  })

  it('skips cards with an empty side', () => {
    expect(toStudyCard(info(1, { Front: 'x', Back: '' }), mapping)).toBeNull()
  })

  it('guesses the mapping from common field names', () => {
    expect(guessMapping(['Front', 'Back'])).toEqual({ english: 'Front', french: 'Back', example: '', kind: '' })
    expect(guessMapping(['Anglais', 'Français', 'Exemple', 'Type'])).toEqual({
      english: 'Anglais',
      french: 'Français',
      example: 'Exemple',
      kind: 'Type',
    })
    expect(guessMapping(['Mot', 'Sens'])).toMatchObject({ english: 'Mot', french: 'Sens' })
  })

  it('loads due cards first, then a capped number of new cards', async () => {
    const anki = fakeAnki((action, params) => {
      if (action === 'findCards') return String(params?.query).includes('is:due') ? [1, 2] : [3, 4, 5]
      if (action === 'cardsInfo') {
        return (params?.cards as number[]).map((id) => info(id, { Front: `en${id}`, Back: `fr${id}` }))
      }
    })
    const client = new AnkiConnectClient({ fetch: anki.fetch })
    const cards = await loadDueCards(client, { deck: 'English', mapping, limit: 10, includeNew: true, newLimit: 2 })
    expect(cards.map((c) => c.id)).toEqual([1, 2, 3, 4])
    expect(anki.calls[0].params?.query).toBe('deck:"English" -is:suspended -is:buried is:due')
  })

  it('appends an accepted answer to a field', () => {
    expect(appendAlternative('emprunter', 'se faire prêter')).toBe('emprunter, se faire prêter')
    expect(appendAlternative('<b>emprunter</b>&nbsp;<br>', 'a<b')).toBe('<b>emprunter</b>, a&lt;b')
    expect(appendAlternative('', 'x')).toBe('x')
  })

  it('adds a new accepted answer to the note in Anki, once', async () => {
    const anki = fakeAnki((action) => {
      if (action === 'cardsInfo') return [info(7, { Front: 'to borrow', Back: 'emprunter' })]
      if (action === 'updateNoteFields') return null
    })
    const client = new AnkiConnectClient({ fetch: anki.fetch })
    await expect(addAcceptedAnswer(client, 7, 'Back', 'se faire prêter', 'fr')).resolves.toBe('added')
    expect(anki.calls[1]).toEqual({
      action: 'updateNoteFields',
      params: { note: { id: 70, fields: { Back: 'emprunter, se faire prêter' } } },
      key: undefined,
    })
    await expect(addAcceptedAnswer(client, 7, 'Back', 'Emprunter', 'fr')).resolves.toBe('present')
    expect(anki.calls.filter((c) => c.action === 'updateNoteFields')).toHaveLength(1)
  })

  it('previews a deck', async () => {
    const anki = fakeAnki((action) => {
      if (action === 'findCards') return [1, 2]
      if (action === 'cardsInfo') return [info(1, { Front: 'a', Back: 'b' }), info(2, { Front: 'c', Back: 'd', Extra: '' })]
    })
    const preview = await previewDeck(new AnkiConnectClient({ fetch: anki.fetch }), 'English')
    expect(preview.fields).toEqual(['Front', 'Back', 'Extra'])
    expect(preview.cardCount).toBe(2)
  })
})
