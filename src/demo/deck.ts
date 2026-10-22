import type { StudyCard } from '../types'

/**
 * Built-in demo deck, written for AnkiVoice and released under the project's
 * MIT licence (no textbook content). Lets anyone try the quiz without Anki.
 * Negative ids make sure nothing is ever sent to Anki for these cards.
 */
export const DEMO_DECK: StudyCard[] = [
  {
    id: -1,
    english: 'to borrow',
    french: 'emprunter',
    example: 'Can I borrow your pen for a minute?',
    kind: 'vocabulary',
  },
  {
    id: -2,
    english: 'a skill',
    french: 'une compétence, un savoir-faire',
    example: 'Public speaking is a skill you can learn.',
    kind: 'vocabulary',
  },
  {
    id: -3,
    english: 'reliable',
    french: 'fiable',
    example: 'My old bike is slow but reliable.',
    kind: 'vocabulary',
  },
  {
    id: -4,
    english: 'to improve',
    french: 'améliorer, progresser',
    example: 'Speaking every day will improve your accent.',
    kind: 'vocabulary',
  },
  {
    id: -5,
    english: 'a drawback',
    french: 'un inconvénient, un défaut',
    example: 'The only drawback of this flat is the noise.',
    kind: 'vocabulary',
  },
  {
    id: -6,
    english: 'although',
    french: 'bien que, même si',
    example: 'Although it was raining, we went for a walk.',
    kind: 'vocabulary',
  },
  {
    id: -7,
    english: 'to look forward to',
    french: 'avoir hâte de',
    example: 'I look forward to meeting you.',
    kind: 'vocabulary',
  },
  {
    id: -8,
    english: 'a meeting',
    french: 'une réunion, un rendez-vous',
    example: 'The meeting has been moved to Thursday.',
    kind: 'vocabulary',
  },
  {
    id: -9,
    english: 'to achieve',
    french: 'réussir, atteindre, accomplir',
    example: 'She achieved her goal in less than a year.',
    kind: 'vocabulary',
  },
  {
    id: -10,
    english: 'nevertheless',
    french: 'néanmoins, pourtant, cependant',
    example: 'The test was hard; nevertheless, everyone passed.',
    kind: 'vocabulary',
  },
  {
    id: -11,
    english: 'she has eaten',
    french: 'elle a mangé',
    example: 'She has already eaten, so she is not hungry.',
    kind: 'conjugation',
  },
  {
    id: -12,
    english: 'I have lived here for ten years',
    french: "j'habite ici depuis dix ans",
    example: 'Present perfect + for: an action that started in the past and is still true.',
    kind: 'grammar',
  },
]
