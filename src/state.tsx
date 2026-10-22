import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { loadSettings, saveSettings, type Settings } from './lib/settings'
import { isSynthesisSupported, loadVoices } from './lib/speech'
import { voicesForLang } from './lib/voices'

type Updater = (update: (draft: Settings) => Settings) => void

const SettingsContext = createContext<[Settings, Updater] | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const update = useCallback<Updater>((fn) => setSettings((prev) => fn(prev)), [])

  useEffect(() => saveSettings(settings), [settings])

  // Theme: explicit choice, or follow the system.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0d14' : '#f8fafc')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings.theme])

  return <SettingsContext.Provider value={[settings, update]}>{children}</SettingsContext.Provider>
}

export function useSettings(): [Settings, Updater] {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside SettingsProvider')
  return value
}

/** Tiny hash router: GitHub Pages serves a single index.html, so routes live after "#". */
export function useHashRoute(): [string, (path: string) => void] {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const navigate = useCallback((path: string) => {
    window.location.hash = path
  }, [])
  return [route, navigate]
}

/** Speech synthesis voices load asynchronously in most browsers. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    isSynthesisSupported() ? window.speechSynthesis.getVoices() : [],
  )
  useEffect(() => {
    if (!isSynthesisSupported()) return
    const onChange = () => setVoices(window.speechSynthesis.getVoices())
    window.speechSynthesis.addEventListener('voiceschanged', onChange)
    onChange()
    return () => window.speechSynthesis.removeEventListener('voiceschanged', onChange)
  }, [])
  return voices
}

/**
 * Whether an English / French voice is installed, once the voice list has
 * loaded (`null` while unknown, so no warning flashes on start-up).
 */
export function useVoiceAvailability(): { en: boolean; fr: boolean } | null {
  const [state, setState] = useState<{ en: boolean; fr: boolean } | null>(null)
  useEffect(() => {
    if (!isSynthesisSupported()) return setState({ en: false, fr: false })
    let alive = true
    const check = (voices: SpeechSynthesisVoice[]) =>
      alive && setState({ en: voicesForLang(voices, 'en-US').length > 0, fr: voicesForLang(voices, 'fr-FR').length > 0 })
    void loadVoices().then(check)
    const onChange = () => check(window.speechSynthesis.getVoices())
    window.speechSynthesis.addEventListener('voiceschanged', onChange)
    return () => {
      alive = false
      window.speechSynthesis.removeEventListener('voiceschanged', onChange)
    }
  }, [])
  return state
}
