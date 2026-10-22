import type { CardKind, Direction, Ease, Outcome, StudyCard } from '../types'

/**
 * The single rule that turns a quiz outcome into an Anki answer:
 * understood by ear (or without a hint) = Good, only after seeing it written
 * (or with a hint) = Hard, missed = Again. Easy is never proposed
 * automatically; the learner can pick it before the grade is sent.
 */
export function easeFor(outcome: Outcome): Ease {
  switch (outcome) {
    case 'first':
      return 3
    case 'retry':
      return 2
    case 'missed':
      return 1
  }
}

export interface CardResult {
  card: StudyCard
  direction: Direction
  outcome: Outcome
  /** Grade actually sent (the learner may have changed the proposal). */
  ease: Ease
  /** What the learner said or typed, in order. */
  answers: string[]
  /** Short feedback from the judge on the last answer. */
  feedback?: string
}

export interface SessionSummary {
  total: number
  /** Ease 3 or 4. */
  succeeded: CardResult[]
  /** Ease 2: found with help, to review soon. */
  toReview: CardResult[]
  /** Ease 1. */
  missed: CardResult[]
  /** Share of cards rated Good or Easy, between 0 and 1. */
  successRate: number
}

export function summarize(results: CardResult[]): SessionSummary {
  const succeeded = results.filter((r) => r.ease >= 3)
  const toReview = results.filter((r) => r.ease === 2)
  const missed = results.filter((r) => r.ease === 1)
  return {
    total: results.length,
    succeeded,
    toReview,
    missed,
    successRate: results.length ? succeeded.length / results.length : 0,
  }
}

/** Reads a free-text "type" field ("Grammaire", "conj.", "vocab") into a kind. */
export function parseKind(raw: string | undefined): CardKind {
  const s = (raw ?? '').toLowerCase()
  if (/conj/.test(s)) return 'conjugation'
  if (/gram/.test(s)) return 'grammar'
  return 'vocabulary'
}
