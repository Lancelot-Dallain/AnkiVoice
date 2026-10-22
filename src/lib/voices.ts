/**
 * Choosing a speech synthesis voice, kept free of browser globals so it can be
 * unit-tested. The rule that matters: never read English with a French voice
 * (Windows often has only a French system voice, and the browser silently
 * falls back to it when no voice is set explicitly).
 */

export type SpeechLang = 'en-US' | 'fr-FR'

/** The fields we use from SpeechSynthesisVoice. */
export interface VoiceLike {
  name: string
  lang: string
  voiceURI: string
  localService?: boolean
}

function normalizedLang(voice: VoiceLike): string {
  return voice.lang.replace('_', '-').toLowerCase()
}

/** Voices that really speak the language ("en-GB" counts for English, "fr-FR" never does). */
export function voicesForLang<V extends VoiceLike>(voices: readonly V[], lang: SpeechLang): V[] {
  const prefix = lang.slice(0, 2).toLowerCase()
  return voices
    .filter((v) => normalizedLang(v).split('-')[0] === prefix)
    .sort((a, b) => voiceScore(b, lang) - voiceScore(a, lang))
}

/** Higher is better: online/neural voices sound far more natural than the old system ones. */
export function voiceScore(voice: VoiceLike, lang: SpeechLang): number {
  let score = 0
  const name = voice.name
  if (normalizedLang(voice) === lang.toLowerCase()) score += 4
  else if (lang === 'en-US' && normalizedLang(voice) === 'en-gb') score += 3
  if (/^Google (US|UK) English/i.test(name) || /^Google français/i.test(name)) score += 6
  if (/Microsoft .*(Natural|Online)/i.test(name)) score += 6
  else if (/natural|neural|online|premium|enhanced/i.test(name)) score += 3
  return score
}

/**
 * The voice to use: the one the learner picked (if it still exists and speaks
 * the right language), otherwise the best available one, otherwise null.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: SpeechLang, preferredURI?: string): V | null {
  const candidates = voicesForLang(voices, lang)
  if (!candidates.length) return null
  return candidates.find((v) => v.voiceURI === preferredURI) ?? candidates[0]
}
