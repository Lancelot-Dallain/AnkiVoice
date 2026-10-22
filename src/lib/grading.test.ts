import { describe, expect, it } from 'vitest'
import type { StudyCard } from '../types'
import { type CardResult, easeFor, parseKind, summarize } from './grading'

describe('easeFor', () => {
  it('maps quiz outcomes to Anki buttons', () => {
    expect(easeFor('first')).toBe(3) // understood by ear → Good
    expect(easeFor('retry')).toBe(2) // only once written → Hard
    expect(easeFor('missed')).toBe(1) // → Again
  })
})

describe('summarize', () => {
  const card = (id: number): StudyCard => ({ id, english: `en${id}`, french: `fr${id}`, kind: 'vocabulary' })
  const result = (id: number, ease: CardResult['ease']): CardResult => ({
    card: card(id),
    direction: 'en-fr',
    outcome: ease >= 3 ? 'first' : ease === 2 ? 'retry' : 'missed',
    ease,
    answers: [],
  })

  it('groups results by the grade actually sent', () => {
    const summary = summarize([result(1, 3), result(2, 4), result(3, 2), result(4, 1)])
    expect(summary.total).toBe(4)
    expect(summary.succeeded.map((r) => r.card.id)).toEqual([1, 2])
    expect(summary.toReview.map((r) => r.card.id)).toEqual([3])
    expect(summary.missed.map((r) => r.card.id)).toEqual([4])
    expect(summary.successRate).toBe(0.5)
  })

  it('handles an empty session', () => {
    expect(summarize([]).successRate).toBe(0)
  })
})

describe('parseKind', () => {
  it('reads free-text type fields', () => {
    expect(parseKind('Grammaire')).toBe('grammar')
    expect(parseKind('conj.')).toBe('conjugation')
    expect(parseKind('Vocabulaire')).toBe('vocabulary')
    expect(parseKind(undefined)).toBe('vocabulary')
  })
})
