import type { DirectionMode } from '../types'
import { DEFAULT_ANKI_URL } from './anki/client'
import { EMPTY_MAPPING, type FieldMapping } from './anki/cards'
import { DEFAULT_LLM_SETTINGS, type LlmSettings } from './llm/types'

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  theme: Theme
  anki: {
    url: string
    /** Only if the user enabled an API key in AnkiConnect's config. */
    apiKey: string
    deck: string
    mapping: FieldMapping
    includeNew: boolean
    newLimit: number
  }
  session: {
    size: number
    mode: DirectionMode
    /** Read the prompt aloud as soon as a card appears. */
    autoSpeak: boolean
    /** Start the microphone right after the prompt is read. */
    autoListen: boolean
  }
  voice: {
    rate: number
    /** Silence every voice (the learner can then rely on the written word). */
    muted: boolean
    enVoice: string
    frVoice: string
  }
  llm: LlmSettings
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  anki: {
    url: DEFAULT_ANKI_URL,
    apiKey: '',
    deck: '',
    mapping: EMPTY_MAPPING,
    includeNew: false,
    newLimit: 5,
  },
  session: { size: 20, mode: 'en-fr', autoSpeak: true, autoListen: false },
  voice: { rate: 0.95, muted: false, enVoice: '', frVoice: '' },
  llm: DEFAULT_LLM_SETTINGS,
}

/** Settings live only in this browser (localStorage). Nothing is sent anywhere. */
export const STORAGE_KEY = 'ankivoice.settings.v1'

type Plain = Record<string, unknown>

function isPlain(value: unknown): value is Plain {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Deep-merges saved values over the defaults, ignoring unknown or mistyped keys. */
export function mergeSettings<T>(defaults: T, saved: unknown): T {
  if (!isPlain(defaults) || !isPlain(saved)) return defaults
  const out: Plain = { ...defaults }
  for (const [key, def] of Object.entries(defaults)) {
    const value = saved[key]
    if (value === undefined) continue
    if (isPlain(def)) out[key] = mergeSettings(def, value)
    else if (typeof value === typeof def) out[key] = value
  }
  return out as T
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): Settings {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    return raw ? mergeSettings(DEFAULT_SETTINGS, JSON.parse(raw)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Private mode or storage disabled: settings simply won't persist.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined
  } catch {
    return undefined
  }
}

/** True when a real Anki session can start. */
export function isAnkiReady(settings: Settings): boolean {
  return Boolean(settings.anki.deck && settings.anki.mapping.english && settings.anki.mapping.french)
}
