import type { Direction, DirectionMode, Ease, Outcome, StudyCard } from '../types'
import { type CardResult, easeFor } from './grading'
import type { Verdict } from './judge'

/**
 * The quiz as a pure state machine, so the rules can be tested without a
 * browser. For each card:
 *
 *   answer (first try) ──right──▶ reveal [Good]
 *        │ wrong
 *        ▼
 *   answer (second try: word written / hint) ──right──▶ reveal [Hard]
 *        │ wrong
 *        ▼
 *   reveal [Again]
 *
 * "I don't know" jumps straight to reveal [Again]. On reveal the learner can
 * change the proposed grade before moving on.
 *
 * "I was right" overrules the judge on the last wrong answer (a valid
 * synonym the card doesn't list): the card counts as found on that try.
 */

export type Stage = 'first' | 'retry'

export interface Attempt {
  text: string
  via: 'voice' | 'keyboard'
  verdict: Verdict
}

export interface SessionState {
  cards: StudyCard[]
  directions: Direction[]
  index: number
  phase: 'answer' | 'reveal' | 'done'
  stage: Stage
  attempts: Attempt[]
  outcome?: Outcome
  ease?: Ease
  results: CardResult[]
}

export type SessionAction =
  | { type: 'answered'; attempt: Attempt }
  | { type: 'give-up' }
  | { type: 'set-ease'; ease: Ease }
  /** The learner overrules the judge: their last wrong answer was right. */
  | { type: 'overrule'; feedback: string }
  | { type: 'next' }

/** Picks a direction per card; "mixed" alternates randomly. */
export function assignDirections(count: number, mode: DirectionMode, random: () => number = Math.random): Direction[] {
  return Array.from({ length: count }, () => (mode === 'mixed' ? (random() < 0.5 ? 'en-fr' : 'fr-en') : mode))
}

export function createSession(cards: StudyCard[], directions: Direction[]): SessionState {
  return {
    cards,
    directions,
    index: 0,
    phase: cards.length ? 'answer' : 'done',
    stage: 'first',
    attempts: [],
    results: [],
  }
}

function reveal(state: SessionState, outcome: Outcome, attempts: Attempt[]): SessionState {
  return { ...state, attempts, phase: 'reveal', outcome, ease: easeFor(outcome) }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'answered': {
      if (state.phase !== 'answer') return state
      const attempts = [...state.attempts, action.attempt]
      if (action.attempt.verdict.correct) return reveal(state, state.stage === 'first' ? 'first' : 'retry', attempts)
      if (state.stage === 'first') return { ...state, attempts, stage: 'retry' }
      return reveal(state, 'missed', attempts)
    }
    case 'give-up':
      if (state.phase !== 'answer') return state
      return reveal(state, 'missed', state.attempts)
    case 'overrule': {
      const i = state.attempts.length - 1
      const last = state.attempts[i]
      if (!last || last.verdict.correct || !last.text.trim()) return state
      const canOverrule = (state.phase === 'answer' && state.stage === 'retry') || (state.phase === 'reveal' && state.outcome === 'missed')
      if (!canOverrule) return state
      const attempts = state.attempts.map((a, k) =>
        k === i ? { ...a, verdict: { ...a.verdict, correct: true, overruled: true, feedback: action.feedback } } : a,
      )
      return reveal(state, i === 0 ? 'first' : 'retry', attempts)
    }
    case 'set-ease':
      if (state.phase !== 'reveal') return state
      return { ...state, ease: action.ease }
    case 'next': {
      if (state.phase !== 'reveal' || !state.outcome || !state.ease) return state
      const last = state.attempts[state.attempts.length - 1]
      const result: CardResult = {
        card: state.cards[state.index],
        direction: state.directions[state.index],
        outcome: state.outcome,
        ease: state.ease,
        answers: state.attempts.map((a) => a.text),
        feedback: last?.verdict.feedback,
      }
      const index = state.index + 1
      return {
        ...state,
        index,
        phase: index < state.cards.length ? 'answer' : 'done',
        stage: 'first',
        attempts: [],
        outcome: undefined,
        ease: undefined,
        results: [...state.results, result],
      }
    }
  }
}

export function currentCard(state: SessionState): { card: StudyCard; direction: Direction } | null {
  if (state.phase === 'done') return null
  return { card: state.cards[state.index], direction: state.directions[state.index] }
}
