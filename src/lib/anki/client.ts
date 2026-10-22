/**
 * Minimal AnkiConnect client (https://foosoft.net/projects/anki-connect/).
 *
 * The browser talks straight to the AnkiConnect add-on running inside the
 * desktop Anki app. Anki stays the source of truth: we only read due cards and
 * send back an answer (1–4); the spaced-repetition scheduling is Anki's.
 */

export const DEFAULT_ANKI_URL = 'http://localhost:8765'
export const ANKICONNECT_VERSION = 6

export type AnkiErrorCode =
  /** Nothing answers: Anki is closed, AnkiConnect is missing, or the browser blocked localhost. */
  | 'unreachable'
  /** Anki answers but refuses this web page (origin not in webCorsOriginList, or permission denied). */
  | 'forbidden'
  /** AnkiConnect requires an API key and the one provided is missing or wrong. */
  | 'apiKey'
  /** AnkiConnect is too old for an action we need (e.g. answerCards). */
  | 'outdated'
  /** AnkiConnect returned an error message. */
  | 'api'

export class AnkiError extends Error {
  readonly code: AnkiErrorCode
  constructor(code: AnkiErrorCode, message: string) {
    super(message)
    this.name = 'AnkiError'
    this.code = code
  }
}

export interface CardInfo {
  cardId: number
  note: number
  deckName: string
  modelName: string
  /** Field name → { value (HTML), order }. */
  fields: Record<string, { value: string; order: number }>
  /** 0 new, 1 learning, 2 review, 3 relearning. */
  type?: number
  due?: number
  interval?: number
}

export interface PermissionResult {
  permission: 'granted' | 'denied'
  requireApikey?: boolean
  version?: number
}

export interface CardAnswer {
  cardId: number
  ease: 1 | 2 | 3 | 4
}

export interface AnkiClientOptions {
  url?: string
  apiKey?: string
  /** Injected in tests; defaults to the browser's fetch. */
  fetch?: typeof fetch
}

export class AnkiConnectClient {
  readonly url: string
  private readonly apiKey?: string
  private readonly fetchImpl: typeof fetch

  constructor(options: AnkiClientOptions = {}) {
    this.url = (options.url || DEFAULT_ANKI_URL).replace(/\/+$/, '')
    this.apiKey = options.apiKey || undefined
    this.fetchImpl = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
  }

  async invoke<T>(action: string, params?: Record<string, unknown>): Promise<T> {
    const body: Record<string, unknown> = { action, version: ANKICONNECT_VERSION }
    if (params) body.params = params
    if (this.apiKey) body.key = this.apiKey

    let response: Response
    try {
      response = await this.fetchImpl(this.url, {
        method: 'POST',
        // text/plain keeps this a "simple" CORS request (no preflight), which is
        // what AnkiConnect expects from web pages.
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body),
      })
    } catch {
      // A browser hides the difference between "nobody listens" and "CORS
      // refused"; `checkConnection` tells them apart with requestPermission.
      throw new AnkiError('unreachable', 'Could not reach AnkiConnect')
    }

    if (response.status === 403) throw new AnkiError('forbidden', 'AnkiConnect refused this origin')
    if (!response.ok) throw new AnkiError('api', `AnkiConnect HTTP ${response.status}`)

    let data: { result?: T; error?: string | null }
    try {
      data = await response.json()
    } catch {
      throw new AnkiError('api', 'AnkiConnect returned an invalid response')
    }
    if (data.error) {
      const message = String(data.error)
      if (/valid api key/i.test(message)) throw new AnkiError('apiKey', message)
      if (/unsupported action/i.test(message)) throw new AnkiError('outdated', message)
      throw new AnkiError('api', message)
    }
    return data.result as T
  }

  /**
   * The only action AnkiConnect accepts from any web page. If this page is not
   * trusted yet, Anki shows a pop-up asking the user to allow it, and adds it
   * to webCorsOriginList on "Yes".
   */
  requestPermission(): Promise<PermissionResult> {
    return this.invoke<PermissionResult>('requestPermission')
  }

  version(): Promise<number> {
    return this.invoke<number>('version')
  }

  deckNames(): Promise<string[]> {
    return this.invoke<string[]>('deckNames')
  }

  findCards(query: string): Promise<number[]> {
    return this.invoke<number[]>('findCards', { query })
  }

  cardsInfo(cards: number[]): Promise<CardInfo[]> {
    if (!cards.length) return Promise.resolve([])
    return this.invoke<CardInfo[]>('cardsInfo', { cards })
  }

  /** Replaces some fields of a note (the others are left untouched). */
  updateNoteFields(noteId: number, fields: Record<string, string>): Promise<null> {
    return this.invoke<null>('updateNoteFields', { note: { id: noteId, fields } })
  }

  /** Answers cards as if the buttons were pressed in Anki's reviewer. */
  answerCards(answers: CardAnswer[]): Promise<boolean[]> {
    if (!answers.length) return Promise.resolve([])
    return this.invoke<boolean[]>('answerCards', { answers })
  }

  /**
   * Full connection check used by the setup screen: is Anki there, does it
   * trust this page, and is AnkiConnect recent enough?
   */
  async checkConnection(): Promise<{ version: number; decks: string[] }> {
    const permission = await this.requestPermission() // throws 'unreachable' if Anki is closed
    if (permission.permission !== 'granted') {
      throw new AnkiError('forbidden', 'Permission denied in Anki')
    }
    if (permission.requireApikey && !this.apiKey) {
      throw new AnkiError('apiKey', 'AnkiConnect requires an API key')
    }
    let version: number
    try {
      version = await this.version()
    } catch (error) {
      // Anki answered requestPermission (open to all) but not this call:
      // the page is not in webCorsOriginList.
      if (error instanceof AnkiError && error.code === 'unreachable') {
        throw new AnkiError('forbidden', 'Origin not allowed by AnkiConnect')
      }
      throw error
    }
    if (version < ANKICONNECT_VERSION) {
      throw new AnkiError('outdated', `AnkiConnect version ${version} is too old`)
    }
    const decks = (await this.deckNames()).slice().sort((a, b) => a.localeCompare(b))
    return { version, decks }
  }
}

/** Quotes a deck name for Anki's search syntax. */
export function deckQuery(deck: string): string {
  return `deck:"${deck.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
