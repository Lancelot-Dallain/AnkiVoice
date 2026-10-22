import type { Direction } from '../types'

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  rsquo: '’',
  lsquo: '‘',
  hellip: '…',
}

/** Turns an Anki field (HTML, sound tags, entities) into plain text. */
export function cleanField(html: string | undefined | null): string {
  if (!html) return ''
  return html
    .replace(/\[sound:[^\]]*\]/g, '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === '#') {
        const hex = entity[1] === 'x' || entity[1] === 'X'
        const code = hex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
        return Number.isFinite(code) ? String.fromCodePoint(code) : match
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match
    })
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

const LEADING_WORDS: Record<'en' | 'fr', RegExp> = {
  en: /^(?:(?:the|a|an|to)\s+)+/,
  fr: /^(?:(?:le|la|les|un|une|des|du|de la|de l)\s+|l\s*'\s*)+/,
}

/**
 * Normalises an answer for comparison: lowercase, no accents, no punctuation,
 * no leading article ("the", "to", "le", "une", "l'"…).
 */
export function normalize(text: string, lang: 'en' | 'fr'): string {
  const s = text
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s.replace(LEADING_WORDS[lang], '').replace(/'/g, ' ').replace(/\s+/g, ' ').trim()
}

/** "atteindre, réaliser (un but) / accomplir" → ["atteindre", "réaliser", "accomplir"] */
export function splitAlternatives(expected: string): string[] {
  return expected
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .split(/[,;/\n]|\s+(?:ou|or)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Classic edit distance (insertions, deletions, substitutions). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

export interface LocalMatch {
  /** The answer matches one of the expected alternatives. */
  correct: boolean
  /** Matched only approximately (a typo or a near-miss transcription). */
  close: boolean
  /** Spelled differently but pronounced the same (French homophones). */
  homophone?: boolean
  /** The expected alternative that matched. */
  matched?: string
}

/** Language the learner has to answer in, for a given direction. */
export function answerLang(direction: Direction): 'en' | 'fr' {
  return direction === 'en-fr' ? 'fr' : 'en'
}

/**
 * Offline judge: compares every candidate (speech recognition returns several
 * guesses) with every accepted answer. Tolerates one typo in short words and
 * two in long ones, and a couple of filler words around the right answer.
 */
export function localMatch(candidates: string[], expected: string, lang: 'en' | 'fr'): LocalMatch {
  const alternatives = splitAlternatives(expected)
    .map((alt) => ({ alt, norm: normalize(alt, lang) }))
    .filter((a) => a.norm)
  let close: LocalMatch | null = null

  for (const raw of candidates) {
    const answer = normalize(raw, lang)
    if (!answer) continue
    for (const { alt, norm } of alternatives) {
      if (answer === norm) return { correct: true, close: false, matched: alt }
      const answerWords = answer.split(' ')
      const altWords = norm.split(' ')
      // Right answer surrounded by a few filler words ("euh emprunter").
      if (answerWords.length <= altWords.length + 2 && ` ${answer} `.includes(` ${norm} `)) {
        return { correct: true, close: false, matched: alt }
      }
      const tolerance = norm.length >= 8 ? 2 : norm.length >= 4 ? 1 : 0
      if (!close && tolerance > 0 && levenshtein(answer, norm) <= tolerance) {
        close = { correct: true, close: true, matched: alt }
      }
      // Same sound, other spelling: "amélioré" for "améliorer", "en prunté" for "emprunter".
      if (lang === 'fr' && (!close || !close.homophone) && frenchSoundKey(answer) === frenchSoundKey(norm)) {
        close = { correct: true, close: true, homophone: true, matched: alt }
      }
    }
  }
  return close ?? { correct: false, close: false }
}

/**
 * A rough "how it sounds" key for French, so that speech recognition picking
 * the wrong homophone is not counted as a mistake. Words that sound alike get
 * the same key: améliorer / amélioré / améliorez / améliorait, compétence /
 * compétences, "en prunter" / emprunter. Expects text already passed through
 * `normalize` (lowercase, no accents). Deliberately tolerant on gender and
 * number agreement, which a vocabulary quiz does not test.
 */
export function frenchSoundKey(normalized: string): string {
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word) =>
      word
        // Silent plural / final consonants, then the many spellings of the "é" ending.
        .replace(/[sx]$/, '')
        .replace(/(aient|ait|ais|ai|ez|er|et|ee|e)$/, '')
        .replace(/[td]$/, '')
        // Same sound, different letters.
        .replace(/ph/g, 'f')
        .replace(/qu/g, 'k')
        .replace(/c(?=[eiy])/g, 's')
        .replace(/g(?=[eiy])/g, 'j')
        .replace(/gu(?=[eiy])/g, 'g')
        .replace(/c/g, 'k')
        .replace(/h/g, '')
        .replace(/y/g, 'i')
        .replace(/eau|au/g, 'o')
        .replace(/ei|ai/g, 'e')
        .replace(/[ae][nm](?=[^aeiou]|$)/g, 'A')
        .replace(/(?:ai|ei|i|u)[nm](?=[^aeiou]|$)/g, 'I')
        .replace(/on(?=[^aeiou]|$)/g, 'O')
        .replace(/(?<=[aeiouAIO])s(?=[aeiou])/g, 'z')
        .replace(/([a-z])\1+/g, '$1'),
    )
    .join('')
}

/** First letter and letter count of the main English answer, for the FR→EN hint. */
export function hintFor(english: string): { first: string; letters: number } {
  const main = normalize(splitAlternatives(english)[0] ?? english, 'en')
  return { first: main.charAt(0).toUpperCase(), letters: main.replace(/[\s']/g, '').length }
}

/** Hides the target word in an example sentence ("Can I ___ your pen?"). */
export function maskInExample(example: string, english: string): string {
  const words = normalize(splitAlternatives(english)[0] ?? english, 'en')
    .split(' ')
    .filter((w) => w.length > 2)
  let out = example
  for (const word of words) {
    // Also hide simple inflections: borrow → borrowed, borrowing, borrows.
    const stem = word.length > 4 ? word.replace(/e$/, '') : word
    out = out.replace(new RegExp(`\\b${escapeRegExp(stem)}[a-z]*`, 'gi'), '___')
  }
  return out
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
