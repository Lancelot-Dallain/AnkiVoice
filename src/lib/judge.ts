import type { CardKind, Direction } from '../types'
import type { LlmProvider } from './llm'
import { answerLang, localMatch } from './text'

export interface JudgeInput {
  direction: Direction
  english: string
  french: string
  example?: string
  kind: CardKind
  /** Speech recognition alternatives (best first) or the typed answer. */
  candidates: string[]
}

export type VerdictSource = 'local' | 'llm'

export interface Verdict {
  correct: boolean
  /** One short sentence for the learner (French), may be empty. */
  feedback: string
  source: VerdictSource
  /** Accepted with a small spelling or transcription difference. */
  close?: boolean
  /** The AI judge was configured but failed; we fell back on the local check. */
  llmError?: string
  /** The learner said "I was right" and overruled the judge. */
  overruled?: boolean
}

export const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    correct: { type: 'boolean' },
    feedback: { type: 'string' },
  },
  required: ['correct', 'feedback'],
  additionalProperties: false,
} as const

const KIND_RULES: Record<CardKind, string> = {
  vocabulary:
    'This is a vocabulary card: accept synonyms and any translation with the same meaning, and ignore gender/number agreement, articles and "to" before verbs.',
  grammar:
    'This is a grammar card: the meaning must be right AND the grammatical structure the card practises must be respected.',
  conjugation:
    'This is a conjugation card: the verb must be in the right tense and person; a different tense is wrong even if the meaning is close.',
}

export const JUDGE_SYSTEM_PROMPT = `You are a kind but rigorous English teacher for French-speaking secondary and university students.
You check ONE answer from a flashcard quiz and reply with JSON only: {"correct": boolean, "feedback": string}.

How to judge:
- The answer usually comes from speech recognition: ignore capitalisation, punctuation, filler words ("euh", "um") and obvious homophones or transcription slips.
- The card lists only SOME possible translations. Accept ANY correct translation of the word or phrase: synonyms, other common meanings of the same word, a verb in the infinitive or with "to", a noun with or without article, a different gender or number. Mark it wrong only if a good dictionary would not give it as a translation, or if it is a different word.
- Several candidate transcriptions may be given; the answer is correct if any of them is.
- Be fair: a learner who clearly knows the word must not be marked wrong for a detail the card does not test.

Feedback: ONE short sentence in French (20 words max), addressed to the learner with "tu". If wrong, say what was expected or what the answer actually means. If right, add a useful nuance or leave it encouraging. No markdown.`

export function buildJudgePrompt(input: JudgeInput): string {
  const toFrench = input.direction === 'en-fr'
  const lines = [
    `Task: translate ${toFrench ? 'from English into French' : 'from French into English'}.`,
    KIND_RULES[input.kind],
    `Word or phrase shown/spoken to the learner: "${toFrench ? input.english : input.french}"`,
    `Answer(s) on the card: "${toFrench ? input.french : input.english}"`,
  ]
  if (input.example) lines.push(`Example sentence on the card: "${input.example}"`)
  lines.push(`Learner's answer (candidates, best first): ${input.candidates.map((c) => `"${c}"`).join(' | ')}`)
  return lines.join('\n')
}

/** Reads the model's reply, tolerating code fences or text around the JSON. */
export function parseVerdict(raw: string): { correct: boolean; feedback: string } {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object in the judge reply')
  const data = JSON.parse(match[0]) as { correct?: unknown; feedback?: unknown }
  let correct: boolean
  if (typeof data.correct === 'boolean') correct = data.correct
  else if (data.correct === 'true' || data.correct === 'false') correct = data.correct === 'true'
  else throw new Error('Judge reply has no "correct" boolean')
  const feedback = typeof data.feedback === 'string' ? data.feedback.trim().slice(0, 240) : ''
  return { correct, feedback }
}

export interface JudgeMessages {
  exact: string
  close: string
  wrongOffline: string
  empty: string
}

/**
 * Decides whether an answer is right.
 * 1. Free, instant local check (exact match, typo tolerance, alternatives).
 * 2. If that fails and an AI is configured, the AI judges meaning (synonyms,
 *    agreement, tense). If the AI fails, we fall back on the local verdict.
 */
export async function judgeAnswer(
  input: JudgeInput,
  provider: LlmProvider | null,
  messages: JudgeMessages,
  signal?: AbortSignal,
): Promise<Verdict> {
  const candidates = input.candidates.map((c) => c.trim()).filter(Boolean)
  if (!candidates.length) return { correct: false, feedback: messages.empty, source: 'local' }

  const expected = input.direction === 'en-fr' ? input.french : input.english
  const local = localMatch(candidates, expected, answerLang(input.direction))
  if (local.correct) {
    return { correct: true, close: local.close, feedback: local.close ? messages.close : messages.exact, source: 'local' }
  }
  if (!provider) return { correct: false, feedback: messages.wrongOffline, source: 'local' }

  try {
    const raw = await provider.complete({
      purpose: 'judge',
      system: JUDGE_SYSTEM_PROMPT,
      user: buildJudgePrompt({ ...input, candidates: candidates.slice(0, 5) }),
      jsonSchema: VERDICT_SCHEMA,
      maxTokens: 400,
      signal,
    })
    const verdict = parseVerdict(raw)
    return { ...verdict, source: 'llm' }
  } catch (error) {
    if (signal?.aborted) throw error
    return {
      correct: false,
      feedback: messages.wrongOffline,
      source: 'local',
      llmError: error instanceof Error ? error.message : String(error),
    }
  }
}
