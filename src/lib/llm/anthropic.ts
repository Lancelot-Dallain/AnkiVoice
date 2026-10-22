import type Anthropic from '@anthropic-ai/sdk'
import { type CompletionRequest, LlmError, type LlmProvider, type LlmSettings } from './types'

type AnthropicModule = typeof import('@anthropic-ai/sdk')

/**
 * Claude, called directly from the browser with the user's own API key.
 * `dangerouslyAllowBrowser` makes the SDK send the
 * `anthropic-dangerous-direct-browser-access` header that the API requires for
 * browser calls. The key never leaves the user's browser except to go to
 * api.anthropic.com. The SDK is loaded on first use to keep the app light for
 * everyone who doesn't pick Claude.
 */
export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic' as const
  private readonly settings: LlmSettings['anthropic']
  private readonly fetchImpl?: typeof fetch
  private sdk?: Promise<{ module: AnthropicModule; client: Anthropic }>

  constructor(settings: LlmSettings['anthropic'], fetchImpl?: typeof fetch) {
    if (!settings.apiKey.trim()) throw new LlmError('config', 'Missing Anthropic API key')
    this.settings = settings
    this.fetchImpl = fetchImpl
  }

  private load() {
    this.sdk ??= import('@anthropic-ai/sdk').then((module) => ({
      module,
      client: new module.default({
        apiKey: this.settings.apiKey.trim(),
        dangerouslyAllowBrowser: true,
        maxRetries: 1,
        timeout: 30_000,
        ...(this.fetchImpl ? { fetch: this.fetchImpl } : {}),
      }),
    }))
    return this.sdk
  }

  async complete(request: CompletionRequest): Promise<string> {
    const { module, client } = await this.load()
    const model = request.purpose === 'judge' ? this.settings.judgeModel : this.settings.model
    try {
      const response = await client.messages.create(
        {
          model,
          max_tokens: request.maxTokens ?? 1024,
          system: request.system,
          messages: [{ role: 'user', content: request.user }],
          output_config: {
            // A quiz verdict needs speed, not deep reasoning.
            effort: request.purpose === 'judge' ? 'low' : 'medium',
            ...(request.jsonSchema ? { format: { type: 'json_schema', schema: request.jsonSchema } } : {}),
          },
        },
        { signal: request.signal },
      )
      if (response.stop_reason === 'refusal') throw new LlmError('other', 'The model declined to answer')
      const text = response.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('')
        .trim()
      if (!text) throw new LlmError('other', 'Empty answer from Claude')
      return text
    } catch (error) {
      throw toLlmError(module, error)
    }
  }
}

function toLlmError(sdk: AnthropicModule, error: unknown): LlmError {
  const { default: Client } = sdk
  if (error instanceof LlmError) return error
  if (error instanceof Client.AuthenticationError || error instanceof Client.PermissionDeniedError) {
    return new LlmError('auth', error.message)
  }
  if (error instanceof Client.NotFoundError) return new LlmError('model', error.message)
  if (error instanceof Client.RateLimitError) return new LlmError('rateLimit', error.message)
  if (error instanceof Client.APIConnectionError) return new LlmError('network', error.message)
  if (error instanceof Client.APIError) return new LlmError('other', error.message)
  return new LlmError('other', error instanceof Error ? error.message : String(error))
}
