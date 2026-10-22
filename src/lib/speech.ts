/**
 * Thin wrappers around the browser's Web Speech API.
 *
 * Honest limits: speech recognition turns sound into the most plausible
 * *word*, it does not measure pronunciation. In Chrome and Edge the audio is
 * processed by Google's / Microsoft's servers. Firefox has no recognition at
 * all, so the quiz always offers a keyboard fallback.
 */

import { pickVoice, type SpeechLang, voicesForLang } from './voices'

export type { SpeechLang }

// The recognition API is still vendor-prefixed and missing from TS's DOM lib.
interface RecognitionAlternative {
  transcript: string
  confidence: number
}
interface RecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: RecognitionAlternative
}
interface RecognitionEvent {
  readonly resultIndex: number
  readonly results: { readonly length: number; [index: number]: RecognitionResult }
}
interface RecognitionErrorEvent {
  readonly error: string
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isRecognitionSupported(): boolean {
  return recognitionCtor() !== null
}

export function isSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export type ListenErrorCode = 'unsupported' | 'not-allowed' | 'no-speech' | 'network' | 'aborted' | 'other'

export class ListenError extends Error {
  readonly code: ListenErrorCode
  constructor(code: ListenErrorCode) {
    super(code)
    this.name = 'ListenError'
    this.code = code
  }
}

export interface ListenHandle {
  /** Resolves with the alternatives (best first), rejects with ListenError. */
  result: Promise<string[]>
  /** Stop listening and keep what was heard so far. */
  stop(): void
  /** Stop and discard. */
  abort(): void
}

/** Listens for one utterance in the given language. */
export function listenOnce(lang: SpeechLang, onInterim?: (text: string) => void): ListenHandle {
  const Ctor = recognitionCtor()
  if (!Ctor) {
    return { result: Promise.reject(new ListenError('unsupported')), stop() {}, abort() {} }
  }
  const recognition = new Ctor()
  recognition.lang = lang
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 5

  let alternatives: string[] = []
  let interim = ''
  let failure: ListenError | null = null
  let aborted = false

  const result = new Promise<string[]>((resolve, reject) => {
    recognition.onresult = (event) => {
      interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        if (res.isFinal) {
          alternatives = Array.from({ length: res.length }, (_, k) => res[k].transcript.trim()).filter(Boolean)
        } else {
          interim += res[0].transcript
        }
      }
      onInterim?.((alternatives[0] ?? interim).trim())
    }
    recognition.onerror = (event) => {
      const code: ListenErrorCode =
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'not-allowed'
          : event.error === 'no-speech'
            ? 'no-speech'
            : event.error === 'network'
              ? 'network'
              : event.error === 'aborted'
                ? 'aborted'
                : 'other'
      failure = new ListenError(code)
    }
    recognition.onend = () => {
      if (aborted) return reject(new ListenError('aborted'))
      // Stopped by hand before a final result: keep the interim text.
      if (!alternatives.length && interim.trim()) alternatives = [interim.trim()]
      if (alternatives.length) return resolve(alternatives)
      reject(failure ?? new ListenError('no-speech'))
    }
  })

  try {
    recognition.start()
  } catch {
    return { result: Promise.reject(new ListenError('other')), stop() {}, abort() {} }
  }

  return {
    result,
    stop: () => recognition.stop(),
    abort: () => {
      aborted = true
      recognition.abort()
    },
  }
}

/** Voices load asynchronously: wait for `voiceschanged` (with a time limit). */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (!isSynthesisSupported()) return Promise.resolve([])
  const synth = window.speechSynthesis
  const now = synth.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer)
      synth.removeEventListener('voiceschanged', done)
      resolve(synth.getVoices())
    }
    const timer = window.setTimeout(done, timeoutMs)
    synth.addEventListener('voiceschanged', done)
  })
}

/** Voices for a language, best first (never a voice of another language). */
export function voicesFor(lang: SpeechLang): SpeechSynthesisVoice[] {
  if (!isSynthesisSupported()) return []
  return voicesForLang(window.speechSynthesis.getVoices(), lang)
}

/** `no-voice`: nothing installed for this language, so we stay silent rather than read it with the wrong accent. */
export type SpeakResult = 'spoken' | 'no-voice' | 'muted' | 'unsupported'

/** Says a text aloud with a voice of the right language; resolves when finished. */
export async function speak(
  text: string,
  lang: SpeechLang,
  options: { rate?: number; voiceURI?: string; muted?: boolean } = {},
): Promise<SpeakResult> {
  if (!isSynthesisSupported()) return 'unsupported'
  if (options.muted) return 'muted'
  if (!text.trim()) return 'spoken'
  const voice = pickVoice(await loadVoices(), lang, options.voiceURI)
  if (!voice) return 'no-voice'
  const synth = window.speechSynthesis
  synth.cancel()
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.voice = voice
    utterance.rate = options.rate ?? 0.95
    // Some browsers never fire `end`: don't hang the quiz.
    const timeout = window.setTimeout(() => resolve('spoken'), 1500 + text.length * 150)
    utterance.onend = utterance.onerror = () => {
      window.clearTimeout(timeout)
      resolve('spoken')
    }
    synth.speak(utterance)
  })
}

export function stopSpeaking(): void {
  if (isSynthesisSupported()) window.speechSynthesis.cancel()
}
