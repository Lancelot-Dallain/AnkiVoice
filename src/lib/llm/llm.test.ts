import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createProvider, DEFAULT_LLM_SETTINGS, LlmError, type LlmSettings, testProvider } from '.'

function captureFetch(status: number, json: unknown) {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } }),
  )
  return fetchMock
}

function headerOf(init: RequestInit | undefined, name: string): string | null {
  const headers = init?.headers as { get?: (name: string) => string | null } | undefined
  // The SDK may hand over its own Headers implementation.
  if (typeof headers?.get === 'function') return headers.get(name)
  return new Headers(init?.headers).get(name)
}

const settings = (patch: Partial<LlmSettings>): LlmSettings => ({ ...DEFAULT_LLM_SETTINGS, ...patch })

const anthropicReply = {
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-5-5',
  content: [
    { type: 'thinking', thinking: '', signature: 'x' },
    { type: 'text', text: '{"correct": true, "feedback": "Bien vu."}' },
  ],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
}

describe('createProvider', () => {
  it('returns null when no AI is chosen', () => {
    expect(createProvider(settings({ provider: 'none' }))).toBeNull()
  })

  it('refuses to build a provider without its required settings', () => {
    expect(() => createProvider(settings({ provider: 'anthropic' }))).toThrow(LlmError)
    expect(() => createProvider(settings({ provider: 'openai' }))).toThrow(LlmError)
  })
})

describe('Anthropic adapter', () => {
  // The SDK is loaded lazily by the adapter; load it once up front so a busy
  // machine doesn't make the first test hit the default 5 s timeout.
  beforeAll(() => import('@anthropic-ai/sdk'), 30_000)

  const config = settings({
    provider: 'anthropic',
    anthropic: { apiKey: 'sk-ant-test', model: 'claude-sonnet-5-5', judgeModel: 'claude-haiku-5-5' },
  })

  it('calls the Messages API from the browser with the judge model and JSON schema', async () => {
    const fetchMock = captureFetch(200, anthropicReply)
    const provider = createProvider(config, fetchMock as unknown as typeof fetch)!
    const text = await provider.complete({
      purpose: 'judge',
      system: 'sys',
      user: 'hello',
      jsonSchema: { type: 'object' },
    })
    expect(text).toBe('{"correct": true, "feedback": "Bien vu."}')

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.anthropic.com/v1/messages')
    expect(headerOf(init, 'authorization')).toBe('Bearer sk-ant-test')
    expect(headerOf(init, 'anthropic-dangerous-direct-browser-access')).toBe('true')
    const body = JSON.parse(String(init?.body))
    expect(body.model).toBe('claude-haiku-5-5')
    expect(body.system).toBe('sys')
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }])
    expect(body.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: { type: 'object' } } })
  })

  it('uses the main model for chat', async () => {
    const fetchMock = captureFetch(200, anthropicReply)
    await createProvider(config, fetchMock as unknown as typeof fetch)!.complete({ purpose: 'chat', system: 's', user: 'u' })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).model).toBe('claude-sonnet-5-5')
  })

  it('maps a wrong key to an "auth" error', async () => {
    const fetchMock = captureFetch(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })
    const provider = createProvider(config, fetchMock as unknown as typeof fetch)!
    await expect(testProvider(provider)).rejects.toMatchObject({ code: 'auth' })
  })
})

describe('OpenAI-compatible adapter', () => {
  const config = settings({
    provider: 'openai',
    openai: { baseUrl: 'https://api.example.com/v1/', apiKey: 'sk-test', model: 'some-model' },
  })

  it('posts a chat completion with a bearer token', async () => {
    const fetchMock = captureFetch(200, { choices: [{ message: { content: ' OK ' } }] })
    const provider = createProvider(config, fetchMock as unknown as typeof fetch)!
    await expect(provider.complete({ purpose: 'judge', system: 's', user: 'u', jsonSchema: {} })).resolves.toBe('OK')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    expect(headerOf(init, 'authorization')).toBe('Bearer sk-test')
    const body = JSON.parse(String(init?.body))
    expect(body.model).toBe('some-model')
    expect(body.messages[0]).toEqual({ role: 'system', content: 's' })
    expect(body.response_format).toEqual({ type: 'json_object' })
  })

  it('maps HTTP errors', async () => {
    const provider = createProvider(config, captureFetch(429, {}) as unknown as typeof fetch)!
    await expect(provider.complete({ purpose: 'judge', system: 's', user: 'u' })).rejects.toMatchObject({ code: 'rateLimit' })
  })

  it('maps network failures', async () => {
    const failing = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch
    const provider = createProvider(config, failing)!
    await expect(provider.complete({ purpose: 'judge', system: 's', user: 'u' })).rejects.toMatchObject({ code: 'network' })
  })
})

describe('Ollama adapter', () => {
  const config = settings({ provider: 'ollama', ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' } })

  it('uses /api/chat without streaming and passes the JSON schema as format', async () => {
    const fetchMock = captureFetch(200, { message: { role: 'assistant', content: '{"correct":false,"feedback":"Non."}' } })
    const provider = createProvider(config, fetchMock as unknown as typeof fetch)!
    await provider.complete({ purpose: 'judge', system: 's', user: 'u', jsonSchema: { type: 'object' } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/chat')
    const body = JSON.parse(String(init?.body))
    expect(body).toMatchObject({ model: 'llama3.2', stream: false, format: { type: 'object' } })
  })

  it('lists installed models', async () => {
    const fetchMock = captureFetch(200, { models: [{ name: 'llama3.2:latest' }, { name: 'mistral:latest' }] })
    const provider = createProvider(config, fetchMock as unknown as typeof fetch)
    const models = await (provider as import('.').OllamaProvider).listModels()
    expect(models).toEqual(['llama3.2:latest', 'mistral:latest'])
  })
})
