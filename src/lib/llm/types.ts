/**
 * One interface for every language model AnkiVoice can use. The quiz never
 * knows which provider is behind it: Claude with the user's own key, any
 * OpenAI-compatible API, or a free local model through Ollama.
 */

export type ProviderId = 'none' | 'anthropic' | 'openai' | 'ollama'

export interface LlmSettings {
  provider: ProviderId
  anthropic: {
    apiKey: string
    /** Main model (reserved for the end-of-session conversation, v0.2). */
    model: string
    /** Cheaper model used to judge answers. */
    judgeModel: string
  }
  openai: {
    baseUrl: string
    apiKey: string
    model: string
  }
  ollama: {
    baseUrl: string
    model: string
  }
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  provider: 'none',
  anthropic: { apiKey: '', model: 'claude-sonnet-5-5', judgeModel: 'claude-haiku-5-5' },
  openai: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: '' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
}

export interface CompletionRequest {
  system: string
  user: string
  /** `judge` uses the provider's cheap/fast model when it has one. */
  purpose: 'judge' | 'chat'
  /** Ask for a JSON object matching this schema (best effort per provider). */
  jsonSchema?: Record<string, unknown>
  maxTokens?: number
  signal?: AbortSignal
}

export interface LlmProvider {
  readonly id: Exclude<ProviderId, 'none'>
  /** Returns the model's text answer. */
  complete(request: CompletionRequest): Promise<string>
}

export type LlmErrorCode = 'auth' | 'network' | 'rateLimit' | 'model' | 'config' | 'other'

export class LlmError extends Error {
  readonly code: LlmErrorCode
  constructor(code: LlmErrorCode, message: string) {
    super(message)
    this.name = 'LlmError'
    this.code = code
  }
}

/** Maps an HTTP status from an LLM API to an error code. */
export function codeForStatus(status: number): LlmErrorCode {
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'model'
  if (status === 429) return 'rateLimit'
  return 'other'
}
