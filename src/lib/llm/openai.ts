import { codeForStatus, type CompletionRequest, LlmError, type LlmProvider, type LlmSettings } from './types'

/**
 * Any API that speaks the OpenAI "chat completions" dialect: OpenAI itself,
 * Mistral, Groq, OpenRouter, LM Studio, a university's own server…
 */
export class OpenAICompatibleProvider implements LlmProvider {
  readonly id = 'openai' as const
  private readonly settings: LlmSettings['openai']
  private readonly fetchImpl: typeof fetch

  constructor(settings: LlmSettings['openai'], fetchImpl?: typeof fetch) {
    if (!settings.baseUrl.trim()) throw new LlmError('config', 'Missing base URL')
    if (!settings.model.trim()) throw new LlmError('config', 'Missing model name')
    this.settings = settings
    this.fetchImpl = fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
  }

  async complete(request: CompletionRequest): Promise<string> {
    const url = `${this.settings.baseUrl.trim().replace(/\/+$/, '')}/chat/completions`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.settings.apiKey.trim()) headers.Authorization = `Bearer ${this.settings.apiKey.trim()}`

    const body: Record<string, unknown> = {
      model: this.settings.model.trim(),
      max_tokens: request.maxTokens ?? 1024,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
    }
    // json_object is the most widely supported JSON mode among compatible APIs.
    if (request.jsonSchema) body.response_format = { type: 'json_object' }

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: request.signal,
      })
    } catch (error) {
      throw new LlmError('network', error instanceof Error ? error.message : 'Network error')
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new LlmError(codeForStatus(response.status), `HTTP ${response.status} ${detail.slice(0, 200)}`.trim())
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) throw new LlmError('other', 'Empty answer')
    return text
  }
}
