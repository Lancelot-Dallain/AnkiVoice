import type { StudyCard } from '../../types'
import { parseKind } from '../grading'
import { cleanField, localMatch } from '../text'
import { type AnkiConnectClient, type CardInfo, deckQuery } from './client'

/** Which Anki field holds what. Empty string = not used. */
export interface FieldMapping {
  english: string
  french: string
  example: string
  /** Field whose text says "vocabulaire", "grammaire" or "conjugaison". */
  kind: string
}

export const EMPTY_MAPPING: FieldMapping = { english: '', french: '', example: '', kind: '' }

function fieldValue(info: CardInfo, name: string): string {
  return name ? cleanField(info.fields[name]?.value) : ''
}

/** Converts AnkiConnect's card info into a quiz card, or null if a side is empty. */
export function toStudyCard(info: CardInfo, mapping: FieldMapping): StudyCard | null {
  const english = fieldValue(info, mapping.english)
  const french = fieldValue(info, mapping.french)
  if (!english || !french) return null
  const example = fieldValue(info, mapping.example)
  return {
    id: info.cardId,
    english,
    french,
    example: example || undefined,
    kind: parseKind(fieldValue(info, mapping.kind)),
  }
}

/** Field names in the deck's note types (several types can share a deck). */
export function collectFieldNames(infos: CardInfo[]): string[] {
  const seen = new Set<string>()
  for (const info of infos) {
    const ordered = Object.entries(info.fields).sort((a, b) => a[1].order - b[1].order)
    for (const [name] of ordered) seen.add(name)
  }
  return [...seen]
}

const GUESSES: Array<[keyof FieldMapping, RegExp]> = [
  ['english', /^(english|anglais|en|word|mot|front|recto|term|terme|question)$/i],
  ['french', /^(french|fran[cç]ais|fr|translation|traduction|meaning|sens|back|verso|answer|r[ée]ponse)$/i],
  ['example', /(example|exemple|sentence|phrase|context|contexte)/i],
  ['kind', /^(type|kind|cat[ée]gorie|category|nature)$/i],
]

/** Best-effort guess of the mapping from field names ("Front"/"Back" etc.). */
export function guessMapping(fields: string[]): FieldMapping {
  const mapping = { ...EMPTY_MAPPING }
  const used = new Set<string>()
  for (const [key, re] of GUESSES) {
    const hit = fields.find((f) => !used.has(f) && re.test(f.trim()))
    if (hit) {
      mapping[key] = hit
      used.add(hit)
    }
  }
  // Fall back on the first two fields for the two sides.
  const rest = fields.filter((f) => !used.has(f))
  if (!mapping.english && rest.length) used.add((mapping.english = rest.shift()!))
  if (!mapping.french && rest.length) used.add((mapping.french = rest.shift()!))
  return mapping
}

export interface DeckPreview {
  fields: string[]
  /** A few raw cards to preview the mapping in the setup screen. */
  samples: CardInfo[]
  cardCount: number
}

/** Field names and a couple of sample cards from a deck. */
export async function previewDeck(client: AnkiConnectClient, deck: string): Promise<DeckPreview> {
  const ids = await client.findCards(deckQuery(deck))
  const infos = await client.cardsInfo(ids.slice(0, 20))
  return { fields: collectFieldNames(infos), samples: infos.slice(0, 3), cardCount: ids.length }
}

export interface LoadOptions {
  deck: string
  mapping: FieldMapping
  /** Maximum number of cards in the session. */
  limit: number
  /** Also bring in cards never studied, after the due ones. */
  includeNew: boolean
  /** Cap on new cards per session (Anki's daily new-card limit does not apply here). */
  newLimit: number
}

/** Due cards first (learning + review), then optionally a few new ones. */
export async function loadDueCards(client: AnkiConnectClient, options: LoadOptions): Promise<StudyCard[]> {
  const base = `${deckQuery(options.deck)} -is:suspended -is:buried`
  const dueIds = await client.findCards(`${base} is:due`)
  let ids = dueIds.slice(0, options.limit)
  if (options.includeNew && ids.length < options.limit && options.newLimit > 0) {
    const newIds = await client.findCards(`${base} is:new`)
    const room = Math.min(options.limit - ids.length, options.newLimit)
    ids = ids.concat(newIds.filter((id) => !ids.includes(id)).slice(0, room))
  }
  const infos = await client.cardsInfo(ids)
  const byId = new Map(infos.map((info) => [info.cardId, info]))
  return ids
    .map((id) => byId.get(id))
    .filter((info): info is CardInfo => Boolean(info))
    .map((info) => toStudyCard(info, options.mapping))
    .filter((card): card is StudyCard => card !== null)
}

/** Appends an answer to a field's HTML ("emprunter" → "emprunter, se faire prêter"). */
export function appendAlternative(fieldHtml: string, answer: string): string {
  const escaped = answer.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const trimmed = fieldHtml.replace(/(\s|&nbsp;|<br\s*\/?>)+$/i, '')
  return trimmed ? `${trimmed}, ${escaped}` : escaped
}

/**
 * Teaches a card a new accepted answer: adds it to the field in Anki so that
 * it is recognised next time, even without an AI. Does nothing if the answer
 * is already there.
 */
export async function addAcceptedAnswer(
  client: AnkiConnectClient,
  cardId: number,
  field: string,
  answer: string,
  lang: 'en' | 'fr',
): Promise<'added' | 'present'> {
  const [info] = await client.cardsInfo([cardId])
  if (!info || !(field in info.fields)) throw new Error(`Field "${field}" not found on card ${cardId}`)
  const current = info.fields[field].value
  const match = localMatch([answer], cleanField(current), lang)
  if (match.correct && !match.close) return 'present'
  await client.updateNoteFields(info.note, { [field]: appendAlternative(current, answer) })
  return 'added'
}
