import { codeForStatus, type CompletionRequest, LlmError, type LlmProvider, type LlmSettings } from './types'

/**
 * A free model running on the learner's own computer through Ollama
 * (https://ollama.com). Nothing leaves the machine and nothing is paid.
 */
export class OllamaProvider implements LlmProvider {
  readonly id = 'ollama' as const
  private readonly settings: LlmSettings['ollama']
  private readonly fetchImpl: typeof fetch

  constructor(settings: LlmSettings['ollama'], fetchImpl?: typeof fetch) {
    if (!settings.model.trim()) throw new LlmError('config', 'Missing model name')
    this.settings = settings
    this.fetchImpl = fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
  }

  private get baseUrl(): string {
    return (this.settings.baseUrl.trim() || 'http://localhost:11434').replace(/\/+$/, '')
  }

  async complete(request: CompletionRequest): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.settings.model.trim(),
      stream: false,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
      options: { temperature: 0, num_predict: request.maxTokens ?? 1024 },
    }
    // Ollama accepts a JSON schema in `format` (structured outputs).
    if (request.jsonSchema) body.format = request.jsonSchema

    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    const data = (await response.json()) as { message?: { content?: string } }
    const text = data.message?.content?.trim()
    if (!text) throw new LlmError('other', 'Empty answer')
    return text
  }

  /** Names of the models installed in Ollama (`ollama list`). */
  async listModels(): Promise<string[]> {
    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/tags`)
    } catch (error) {
      throw new LlmError('network', error instanceof Error ? error.message : 'Network error')
    }
    if (!response.ok) throw new LlmError(codeForStatus(response.status), `HTTP ${response.status}`)
    const data = (await response.json()) as { models?: Array<{ name: string }> }
    return (data.models ?? []).map((m) => m.name)
  }
}
