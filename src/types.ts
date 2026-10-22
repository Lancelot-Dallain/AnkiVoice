/** What a card teaches. Drives badges and how strict the AI judge is. */
export type CardKind = 'vocabulary' | 'grammar' | 'conjugation'

/** A card ready to be quizzed, already cleaned of Anki's HTML. */
export interface StudyCard {
  /** Anki card id (negative ids are used for the built-in demo deck). */
  id: number
  english: string
  french: string
  example?: string
  kind: CardKind
}

/** Direction of a single question. */
export type Direction = 'en-fr' | 'fr-en'

/** Direction chosen for a whole session. */
export type DirectionMode = Direction | 'mixed'

/**
 * How the learner did on a card:
 * - `first`: right on the first try (heard only for EN→FR, no hint for FR→EN)
 * - `retry`: right on the second try (word shown in writing, or with a hint)
 * - `missed`: wrong twice, or gave up
 */
export type Outcome = 'first' | 'retry' | 'missed'

/** Anki's answer buttons: 1 Again, 2 Hard, 3 Good, 4 Easy. */
export type Ease = 1 | 2 | 3 | 4
