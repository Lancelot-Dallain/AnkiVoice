import { AnthropicProvider } from './anthropic'
import { OllamaProvider } from './ollama'
import { OpenAICompatibleProvider } from './openai'
import type { LlmProvider, LlmSettings } from './types'

export * from './types'
export { AnthropicProvider, OllamaProvider, OpenAICompatibleProvider }

/** Builds the provider chosen in the settings, or null for "no AI". */
export function createProvider(settings: LlmSettings, fetchImpl?: typeof fetch): LlmProvider | null {
  switch (settings.provider) {
    case 'anthropic':
      return new AnthropicProvider(settings.anthropic, fetchImpl)
    case 'openai':
      return new OpenAICompatibleProvider(settings.openai, fetchImpl)
    case 'ollama':
      return new OllamaProvider(settings.ollama, fetchImpl)
    case 'none':
      return null
  }
}

/** Round-trip check for the "Test" button: returns what the model replied. */
export async function testProvider(provider: LlmProvider): Promise<string> {
  const reply = await provider.complete({
    purpose: 'judge',
    system: 'You are a connectivity check. Answer with one short word.',
    user: 'Reply with exactly: OK',
    maxTokens: 64,
  })
  return reply.slice(0, 80)
}
