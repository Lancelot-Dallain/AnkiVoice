import { describe, expect, it, vi } from 'vitest'
import { buildJudgePrompt, JUDGE_SYSTEM_PROMPT, type JudgeInput, judgeAnswer, parseVerdict } from './judge'
import type { LlmProvider } from './llm'

const messages = { exact: 'Exact !', close: 'Presque', wrongOffline: 'Pas tout à fait.', empty: 'Rien entendu.' }

const input = (candidates: string[], patch: Partial<JudgeInput> = {}): JudgeInput => ({
  direction: 'en-fr',
  english: 'to borrow',
  french: 'emprunter',
  kind: 'vocabulary',
  candidates,
  ...patch,
})

function fakeProvider(reply: string | Error): LlmProvider & { complete: ReturnType<typeof vi.fn> } {
  return {
    id: 'anthropic',
    complete: vi.fn(async () => {
      if (reply instanceof Error) throw reply
      return reply
    }),
  }
}

describe('judgeAnswer', () => {
  it('accepts exact answers locally without calling the AI', async () => {
    const provider = fakeProvider('{}')
    const verdict = await judgeAnswer(input(['Emprunter']), provider, messages)
    expect(verdict).toMatchObject({ correct: true, source: 'local', feedback: 'Exact !' })
    expect(provider.complete).not.toHaveBeenCalled()
  })

  it('asks the AI when the local check fails (synonyms)', async () => {
    const provider = fakeProvider('{"correct": true, "feedback": "Oui, « se faire prêter » marche aussi."}')
    const verdict = await judgeAnswer(input(['se faire prêter']), provider, messages)
    expect(verdict).toEqual({ correct: true, feedback: 'Oui, « se faire prêter » marche aussi.', source: 'llm' })
    const request = provider.complete.mock.calls[0][0]
    expect(request.purpose).toBe('judge')
    expect(request.jsonSchema).toBeDefined()
    expect(request.user).toContain('"se faire prêter"')
  })

  it('falls back on the local verdict when the AI fails', async () => {
    const verdict = await judgeAnswer(input(['prêter']), fakeProvider(new Error('offline')), messages)
    expect(verdict).toMatchObject({ correct: false, source: 'local', llmError: 'offline' })
  })

  it('without AI, a non-matching answer is wrong', async () => {
    await expect(judgeAnswer(input(['prêter']), null, messages)).resolves.toMatchObject({ correct: false })
  })

  it('an empty answer is wrong without calling anything', async () => {
    const provider = fakeProvider('{}')
    await expect(judgeAnswer(input(['  ']), provider, messages)).resolves.toMatchObject({ correct: false, feedback: 'Rien entendu.' })
    expect(provider.complete).not.toHaveBeenCalled()
  })

  it('judges FR→EN answers against the English side', async () => {
    const verdict = await judgeAnswer(input(['borrow'], { direction: 'fr-en' }), null, messages)
    expect(verdict.correct).toBe(true)
  })
})

describe('parseVerdict', () => {
  it('reads JSON even inside code fences or text', () => {
    expect(parseVerdict('```json\n{"correct": false, "feedback": "Non"}\n```')).toEqual({ correct: false, feedback: 'Non' })
    expect(parseVerdict('Sure! {"correct": "true", "feedback": "Oui"}')).toEqual({ correct: true, feedback: 'Oui' })
  })

  it('rejects replies without a verdict', () => {
    expect(() => parseVerdict('I think so')).toThrow()
    expect(() => parseVerdict('{"feedback": "?"}')).toThrow()
  })
})

describe('buildJudgePrompt', () => {
  it('states the direction, the card type rule and every candidate', () => {
    const prompt = buildJudgePrompt(input(['emprunté', 'en prunté'], { kind: 'conjugation', example: 'Can I borrow it?' }))
    expect(prompt).toContain('from English into French')
    expect(prompt).toContain('conjugation card')
    expect(prompt).toContain('"emprunté" | "en prunté"')
    expect(prompt).toContain('Can I borrow it?')
  })

  it('tells the AI that the card does not list every valid translation', () => {
    expect(JUDGE_SYSTEM_PROMPT).toContain('The card lists only SOME possible translations')
  })
})
