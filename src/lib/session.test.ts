import { describe, expect, it } from 'vitest'
import { DEMO_DECK } from '../demo/deck'
import type { Verdict } from './judge'
import { answerToSay, type Attempt, assignDirections, canPlayAnswer, createSession, sessionReducer, type SessionState } from './session'
import { DEFAULT_SETTINGS, loadSettings, mergeSettings, saveSettings, STORAGE_KEY } from './settings'

const right: Verdict = { correct: true, feedback: '', source: 'local' }
const wrong: Verdict = { correct: false, feedback: '', source: 'local' }
const attempt = (verdict: Verdict, text = 'x'): Attempt => ({ text, via: 'keyboard', verdict })

function start(n = 3): SessionState {
  const cards = DEMO_DECK.slice(0, n)
  return createSession(cards, assignDirections(cards.length, 'en-fr'))
}

describe('session state machine', () => {
  it('right on the first try (heard only) → Good', () => {
    const s = sessionReducer(start(), { type: 'answered', attempt: attempt(right) })
    expect(s).toMatchObject({ phase: 'reveal', outcome: 'first', ease: 3 })
  })

  it('wrong, then right once written → Hard', () => {
    let s = sessionReducer(start(), { type: 'answered', attempt: attempt(wrong) })
    expect(s).toMatchObject({ phase: 'answer', stage: 'retry' })
    s = sessionReducer(s, { type: 'answered', attempt: attempt(right) })
    expect(s).toMatchObject({ phase: 'reveal', outcome: 'retry', ease: 2 })
  })

  it('wrong twice → Again', () => {
    let s = sessionReducer(start(), { type: 'answered', attempt: attempt(wrong) })
    s = sessionReducer(s, { type: 'answered', attempt: attempt(wrong) })
    expect(s).toMatchObject({ phase: 'reveal', outcome: 'missed', ease: 1 })
  })

  it('"I don\'t know" → Again', () => {
    const s = sessionReducer(start(), { type: 'give-up' })
    expect(s).toMatchObject({ phase: 'reveal', outcome: 'missed', ease: 1 })
  })

  it('lets the learner change the grade before it is recorded', () => {
    let s = sessionReducer(start(), { type: 'answered', attempt: attempt(right, 'emprunter') })
    s = sessionReducer(s, { type: 'set-ease', ease: 4 })
    s = sessionReducer(s, { type: 'next' })
    expect(s.results[0]).toMatchObject({ ease: 4, outcome: 'first', answers: ['emprunter'] })
    expect(s).toMatchObject({ index: 1, phase: 'answer', stage: 'first', attempts: [] })
  })

  it('"I was right" after a first wrong answer counts as found by ear → Good', () => {
    let s = sessionReducer(start(), { type: 'answered', attempt: attempt(wrong, 'se faire prêter') })
    s = sessionReducer(s, { type: 'overrule', feedback: 'Accepté' })
    expect(s).toMatchObject({ phase: 'reveal', outcome: 'first', ease: 3 })
    expect(s.attempts[0].verdict).toMatchObject({ correct: true, overruled: true, feedback: 'Accepté' })
  })

  it('"I was right" on the second answer → Hard', () => {
    let s = sessionReducer(start(), { type: 'answered', attempt: attempt(wrong, 'a') })
    s = sessionReducer(s, { type: 'answered', attempt: attempt(wrong, 'b') })
    s = sessionReducer(s, { type: 'overrule', feedback: '' })
    expect(s).toMatchObject({ phase: 'reveal', outcome: 'retry', ease: 2 })
  })

  it('cannot overrule a right answer, an empty one, or nothing', () => {
    const fresh = start()
    expect(sessionReducer(fresh, { type: 'overrule', feedback: '' })).toBe(fresh)
    const ok = sessionReducer(start(), { type: 'answered', attempt: attempt(right) })
    expect(sessionReducer(ok, { type: 'overrule', feedback: '' })).toBe(ok)
    const silent = sessionReducer(start(), { type: 'answered', attempt: attempt(wrong, '  ') })
    expect(sessionReducer(silent, { type: 'overrule', feedback: '' })).toBe(silent)
  })

  it('"That\'s not what I said" drops a misheard first answer without penalty', () => {
    const misheard: Attempt = { text: 'en printemps', via: 'voice', verdict: wrong }
    let s = sessionReducer(start(), { type: 'answered', attempt: misheard })
    s = sessionReducer(s, { type: 'retract' })
    expect(s).toMatchObject({ phase: 'answer', stage: 'first', attempts: [] })
    s = sessionReducer(s, { type: 'answered', attempt: { ...misheard, text: 'emprunter', verdict: right } })
    expect(s).toMatchObject({ outcome: 'first', ease: 3 })
  })

  it('"That\'s not what I said" after a second misheard answer goes back to the second try', () => {
    const voiceWrong: Attempt = { text: 'x', via: 'voice', verdict: wrong }
    let s = sessionReducer(start(), { type: 'answered', attempt: voiceWrong })
    s = sessionReducer(s, { type: 'answered', attempt: { ...voiceWrong, text: 'y' } })
    expect(s.phase).toBe('reveal')
    s = sessionReducer(s, { type: 'retract' })
    expect(s).toMatchObject({ phase: 'answer', stage: 'retry', outcome: undefined, ease: undefined })
    expect(s.attempts.map((a) => a.text)).toEqual(['x'])
  })

  it('cannot retract a typed answer or a right one', () => {
    const typed = sessionReducer(start(), { type: 'answered', attempt: attempt(wrong) })
    expect(sessionReducer(typed, { type: 'retract' })).toBe(typed)
    const ok = sessionReducer(start(), { type: 'answered', attempt: { text: 'a', via: 'voice', verdict: right } })
    expect(sessionReducer(ok, { type: 'retract' })).toBe(ok)
  })

  it('ends after the last card', () => {
    let s = start(1)
    s = sessionReducer(s, { type: 'give-up' })
    s = sessionReducer(s, { type: 'next' })
    expect(s.phase).toBe('done')
    expect(s.results).toHaveLength(1)
  })

  it('ignores actions that make no sense in the current phase', () => {
    const s = start()
    expect(sessionReducer(s, { type: 'next' })).toBe(s)
    expect(sessionReducer(s, { type: 'set-ease', ease: 4 })).toBe(s)
  })

  it('an empty deck is immediately done', () => {
    expect(createSession([], []).phase).toBe('done')
  })
})

describe('"Écouter la réponse" button', () => {
  it('is absent before the answer is revealed, even on the second try', () => {
    const s = start()
    expect(canPlayAnswer(s)).toBe(false)
    expect(canPlayAnswer(sessionReducer(s, { type: 'answered', attempt: attempt(wrong) }))).toBe(false)
  })

  it('is present after a right answer, a final miss, or "I don\'t know"', () => {
    expect(canPlayAnswer(sessionReducer(start(), { type: 'answered', attempt: attempt(right) }))).toBe(true)
    let missed = sessionReducer(start(), { type: 'answered', attempt: attempt(wrong) })
    missed = sessionReducer(missed, { type: 'answered', attempt: attempt(wrong) })
    expect(canPlayAnswer(missed)).toBe(true)
    expect(canPlayAnswer(sessionReducer(start(), { type: 'give-up' }))).toBe(true)
  })

  it('disappears again on the next card', () => {
    let s = sessionReducer(start(), { type: 'give-up' })
    s = sessionReducer(s, { type: 'next' })
    expect(canPlayAnswer(s)).toBe(false)
  })

  it('reads the answer in its own language', () => {
    const card = DEMO_DECK[0]
    expect(answerToSay(card, 'en-fr')).toEqual({ text: 'emprunter', lang: 'fr-FR' })
    expect(answerToSay(card, 'fr-en')).toEqual({ text: 'to borrow', lang: 'en-US' })
  })
})

describe('assignDirections', () => {
  it('uses the chosen direction or alternates when mixed', () => {
    expect(assignDirections(2, 'fr-en')).toEqual(['fr-en', 'fr-en'])
    const values = [0.1, 0.9, 0.4]
    expect(assignDirections(3, 'mixed', () => values.shift()!)).toEqual(['en-fr', 'fr-en', 'en-fr'])
  })
})

describe('settings persistence', () => {
  it('merges saved values over defaults and ignores junk', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, {
      theme: 'dark',
      session: { size: 10, mode: 42 },
      unknown: true,
      llm: { provider: 'ollama' },
    })
    expect(merged.theme).toBe('dark')
    expect(merged.session.size).toBe(10)
    expect(merged.session.mode).toBe(DEFAULT_SETTINGS.session.mode)
    expect(merged.llm.provider).toBe('ollama')
    expect(merged.llm.anthropic.judgeModel).toBe('claude-haiku-5-5')
    expect('unknown' in merged).toBe(false)
  })

  it('round-trips through storage and survives corrupt data', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    saveSettings({ ...DEFAULT_SETTINGS, theme: 'light' }, storage)
    expect(loadSettings(storage).theme).toBe('light')
    store.set(STORAGE_KEY, '{not json')
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })
})
