import { describe, expect, it } from 'vitest'
import { pickVoice, type VoiceLike, voicesForLang } from './voices'

const v = (name: string, lang: string): VoiceLike => ({ name, lang, voiceURI: name })

const FRENCH_ONLY = [v('Microsoft Hortense - French (France)', 'fr-FR'), v('Microsoft Paul - French (France)', 'fr-FR')]
const MIXED = [
  v('Microsoft Hortense - French (France)', 'fr-FR'),
  v('Microsoft Zira - English (United States)', 'en-US'),
  v('Google UK English Female', 'en-GB'),
  v('Google US English', 'en-US'),
  v('Microsoft Denise Online (Natural) - French (France)', 'fr-FR'),
]

describe('pickVoice', () => {
  it('never reads English with a French voice', () => {
    expect(pickVoice(FRENCH_ONLY, 'en-US')).toBeNull()
    expect(voicesForLang(FRENCH_ONLY, 'en-US')).toEqual([])
  })

  it('still finds a French voice in a French-only list', () => {
    expect(pickVoice(FRENCH_ONLY, 'fr-FR')?.lang).toBe('fr-FR')
  })

  it('prefers high-quality voices of the right language', () => {
    expect(pickVoice(MIXED, 'en-US')?.name).toBe('Google US English')
    expect(pickVoice(MIXED, 'fr-FR')?.name).toBe('Microsoft Denise Online (Natural) - French (France)')
  })

  it('accepts British English when no US voice exists', () => {
    expect(pickVoice([v('Microsoft Hazel - English (Great Britain)', 'en_GB'), ...FRENCH_ONLY], 'en-US')?.name).toBe(
      'Microsoft Hazel - English (Great Britain)',
    )
  })

  it('honours the learner’s choice, unless it is the wrong language', () => {
    expect(pickVoice(MIXED, 'en-US', 'Microsoft Zira - English (United States)')?.name).toBe(
      'Microsoft Zira - English (United States)',
    )
    expect(pickVoice(MIXED, 'en-US', 'Microsoft Hortense - French (France)')?.name).toBe('Google US English')
  })

  it('returns null for an empty list', () => {
    expect(pickVoice([], 'en-US')).toBeNull()
    expect(pickVoice([], 'fr-FR')).toBeNull()
  })
})
