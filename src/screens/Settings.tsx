import { Bot, Check, ChevronDown, Copy, Cpu, KeyRound, Palette, PlugZap, Server, Volume2, WifiOff } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Badge, Button, Card, cx, Field, Input, Segmented, Select, Toggle } from '../components/ui'
import { t } from '../i18n'
import { type DeckPreview, type FieldMapping, guessMapping, previewDeck, toStudyCard } from '../lib/anki/cards'
import { AnkiConnectClient, AnkiError } from '../lib/anki/client'
import { createProvider, LlmError, OllamaProvider, type ProviderId, testProvider } from '../lib/llm'
import type { Settings as SettingsShape, Theme } from '../lib/settings'
import { speak, type SpeechLang, voicesFor } from '../lib/speech'
import { useSettings, useVoiceAvailability, useVoices } from '../state'

export function Settings() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t.settings.title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{t.settings.subtitle}</p>
      <div className="mt-8 space-y-6">
        <AnkiSection />
        <LlmSection />
        <VoiceSection />
        <AppearanceSection />
      </div>
    </div>
  )
}

function Section({ icon, title, intro, children, id }: { icon: ReactNode; title: string; intro?: string; children: ReactNode; id: string }) {
  return (
    <Card className="p-5 sm:p-8">
      <section aria-labelledby={id}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">{icon}</span>
          <h2 id={id} className="font-display text-xl font-bold">
            {title}
          </h2>
        </div>
        {intro && <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{intro}</p>}
        <div className="mt-6 space-y-5">{children}</div>
      </section>
    </Card>
  )
}

function ankiErrorMessage(error: unknown): string {
  const errors = t.settings.anki.errors
  if (error instanceof AnkiError) return error.code === 'api' ? errors.api(error.message) : errors[error.code]
  return errors.api(error instanceof Error ? error.message : String(error))
}

/* ────────────────────────────── Anki ────────────────────────────── */

function AnkiSection() {
  const [settings, update] = useSettings()
  const anki = settings.anki
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [decks, setDecks] = useState<string[]>([])
  const [preview, setPreview] = useState<DeckPreview | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)

  const setAnki = useCallback(
    (patch: Partial<SettingsShape['anki']>) => update((s) => ({ ...s, anki: { ...s.anki, ...patch } })),
    [update],
  )

  const client = useMemo(() => new AnkiConnectClient({ url: anki.url, apiKey: anki.apiKey }), [anki.url, anki.apiKey])

  const loadPreview = useCallback(
    async (deck: string, keepMapping: boolean) => {
      if (!deck) return setPreview(null)
      try {
        const result = await previewDeck(client, deck)
        setPreview(result)
        const mapping = anki.mapping
        const stillValid = keepMapping && mapping.english && result.fields.includes(mapping.english) && result.fields.includes(mapping.french)
        if (!stillValid) setAnki({ mapping: guessMapping(result.fields) })
      } catch (error) {
        setStatus('error')
        setMessage(ankiErrorMessage(error))
      }
    },
    [client, anki.mapping, setAnki],
  )

  const connect = useCallback(async () => {
    setStatus('connecting')
    setMessage('')
    try {
      const { version, decks } = await client.checkConnection()
      setDecks(decks)
      setStatus('connected')
      setMessage(t.settings.anki.connected(version, decks.length))
      if (anki.deck && decks.includes(anki.deck)) void loadPreview(anki.deck, true)
    } catch (error) {
      setStatus('error')
      setMessage(ankiErrorMessage(error))
      if (error instanceof AnkiError && (error.code === 'forbidden' || error.code === 'unreachable')) setGuideOpen(true)
    }
  }, [client, anki.deck, loadPreview])

  // Already set up before: reconnect silently (no Anki pop-up for a trusted page).
  const autoConnected = useRef(false)
  useEffect(() => {
    if (!autoConnected.current && anki.deck) {
      autoConnected.current = true
      void connect()
    }
  }, [anki.deck, connect])

  const chooseDeck = (deck: string) => {
    setAnki({ deck })
    void loadPreview(deck, false)
  }

  const setField = (key: keyof FieldMapping, value: string) => setAnki({ mapping: { ...anki.mapping, [key]: value } })

  const sample = preview?.samples.map((info) => toStudyCard(info, anki.mapping)).find(Boolean)

  return (
    <Section id="anki" icon={<PlugZap className="size-5" />} title={t.settings.anki.title} intro={t.settings.anki.intro}>
      <Guide open={guideOpen} onToggle={() => setGuideOpen((v) => !v)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.settings.anki.url} htmlFor="anki-url">
          <Input id="anki-url" value={anki.url} onChange={(e) => setAnki({ url: e.target.value })} spellCheck={false} />
        </Field>
        <Field label={t.settings.anki.apiKey} help={t.settings.anki.apiKeyHelp} htmlFor="anki-key">
          <Input
            id="anki-key"
            type="password"
            value={anki.apiKey}
            onChange={(e) => setAnki({ apiKey: e.target.value })}
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={status === 'connected' ? 'secondary' : 'primary'}
          loading={status === 'connecting'}
          onClick={connect}
          icon={<PlugZap className="size-4" />}
        >
          {status === 'connecting' ? t.settings.anki.connecting : status === 'connected' ? t.settings.anki.reconnect : t.settings.anki.connect}
        </Button>
        {status === 'connected' && (
          <Badge tone="success">
            <Check className="size-3.5" /> OK
          </Badge>
        )}
      </div>
      {status === 'connecting' && <p className="text-sm text-slate-500 dark:text-slate-400">{t.settings.anki.permissionHint}</p>}
      {status === 'connected' && <Alert tone="success">{message}</Alert>}
      {status === 'error' && <Alert tone="error">{message}</Alert>}

      {(status === 'connected' || anki.deck) && (
        <>
          <Field
            label={t.settings.anki.deck}
            htmlFor="anki-deck"
            help={preview ? t.settings.anki.cardCount(preview.cardCount) : undefined}
          >
            <Select id="anki-deck" value={anki.deck} onChange={(e) => chooseDeck(e.target.value)} disabled={!decks.length}>
              <option value="">{t.settings.anki.deckPlaceholder}</option>
              {(decks.length ? decks : [anki.deck]).map((deck) => (
                <option key={deck} value={deck}>
                  {deck}
                </option>
              ))}
            </Select>
          </Field>

          {preview && (
            <div className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5 dark:border-white/10">
              <div>
                <p className="font-semibold">{t.settings.anki.mapping}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.settings.anki.mappingHelp}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {(['english', 'french', 'example', 'kind'] as Array<keyof FieldMapping>).map((key) => (
                  <Field key={key} label={t.settings.anki.fields[key]} htmlFor={`map-${key}`}>
                    <Select id={`map-${key}`} value={anki.mapping[key]} onChange={(e) => setField(key, e.target.value)}>
                      <option value="">{t.settings.anki.none}</option>
                      {preview.fields.map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
              {sample && (
                <div className="rounded-xl bg-slate-900/[0.03] p-4 text-sm dark:bg-white/[0.04]">
                  <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">{t.settings.anki.preview}</p>
                  <p>
                    <span className="font-semibold">{sample.english}</span>
                    <span className="text-slate-400"> → </span>
                    <span className="font-semibold">{sample.french}</span>
                  </p>
                  {sample.example && <p className="mt-1 text-slate-500 italic dark:text-slate-400">« {sample.example} »</p>}
                  <Badge className="mt-2">{t.quiz.kinds[sample.kind]}</Badge>
                </div>
              )}
            </div>
          )}

          <Toggle checked={anki.includeNew} onChange={(includeNew) => setAnki({ includeNew })} label={t.settings.anki.includeNew} />
          {anki.includeNew && (
            <Field label={t.settings.anki.newLimit} htmlFor="new-limit">
              <Input
                id="new-limit"
                type="number"
                min={1}
                max={50}
                value={anki.newLimit}
                onChange={(e) => setAnki({ newLimit: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                className="max-w-28"
              />
            </Field>
          )}
        </>
      )}
    </Section>
  )
}

function Guide({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(origin)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard unavailable: the address stays visible for manual copy.
    }
  }
  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left text-sm font-semibold"
      >
        {t.settings.anki.guideTitle}
        <ChevronDown className={cx('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-4">
          <ol className="space-y-3">
            {t.settings.anki.guide.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{t.settings.anki.originLabel}</p>
            <div className="flex gap-2">
              <code className="flex h-10 min-w-0 flex-1 items-center truncate rounded-xl bg-slate-900/5 px-3 font-mono text-sm dark:bg-white/10">
                {origin}
              </code>
              <Button size="sm" className="h-10" onClick={copy} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}>
                {copied ? t.settings.anki.copied : t.settings.anki.copy}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────── LLM ────────────────────────────── */

const PROVIDER_ICONS: Record<ProviderId, ReactNode> = {
  none: <WifiOff className="size-5" />,
  ollama: <Cpu className="size-5" />,
  anthropic: <Bot className="size-5" />,
  openai: <Server className="size-5" />,
}

function LlmSection() {
  const [settings, update] = useSettings()
  const llm = settings.llm
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'error'; message: string }>({ state: 'idle', message: '' })
  const [ollamaModels, setOllamaModels] = useState<string[]>([])

  const setLlm = (fn: (l: SettingsShape['llm']) => SettingsShape['llm']) => {
    setTest({ state: 'idle', message: '' })
    update((s) => ({ ...s, llm: fn(s.llm) }))
  }

  const runTest = async () => {
    setTest({ state: 'testing', message: '' })
    try {
      const provider = createProvider(llm)
      if (!provider) return setTest({ state: 'idle', message: '' })
      if (provider instanceof OllamaProvider) setOllamaModels(await provider.listModels().catch(() => []))
      const reply = await testProvider(provider)
      setTest({ state: 'ok', message: t.settings.llm.testOk(reply) })
    } catch (error) {
      const errors = t.settings.llm.errors
      const message =
        error instanceof LlmError
          ? error.code === 'other'
            ? errors.other(error.message)
            : errors[error.code]
          : errors.other(String(error))
      setTest({ state: 'error', message })
    }
  }

  const providers: ProviderId[] = ['none', 'ollama', 'anthropic', 'openai']

  return (
    <Section id="llm" icon={<Bot className="size-5" />} title={t.settings.llm.title} intro={t.settings.llm.intro}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t.settings.llm.title}>
        {providers.map((id) => {
          const active = llm.provider === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setLlm((l) => ({ ...l, provider: id }))}
              className={cx(
                'flex cursor-pointer flex-col items-start gap-2 rounded-2xl border-2 p-3.5 text-left transition',
                active
                  ? 'border-violet-500 bg-violet-500/[0.06]'
                  : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20',
              )}
            >
              <span className={cx(active ? 'text-violet-600 dark:text-violet-300' : 'text-slate-400')}>{PROVIDER_ICONS[id]}</span>
              <span className="text-sm font-bold">{t.settings.llm.providers[id].label}</span>
              <span className="text-xs leading-snug text-slate-500 dark:text-slate-400">{t.settings.llm.providers[id].text}</span>
            </button>
          )
        })}
      </div>

      {llm.provider === 'anthropic' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t.settings.llm.apiKey} help={t.settings.llm.apiKeyHelp} htmlFor="anthropic-key">
              <Input
                id="anthropic-key"
                type="password"
                placeholder="sk-ant-…"
                value={llm.anthropic.apiKey}
                onChange={(e) => setLlm((l) => ({ ...l, anthropic: { ...l.anthropic, apiKey: e.target.value } }))}
                autoComplete="off"
              />
            </Field>
          </div>
          <Field label={t.settings.llm.judgeModel} help={t.settings.llm.judgeModelHelp} htmlFor="anthropic-judge">
            <Input
              id="anthropic-judge"
              value={llm.anthropic.judgeModel}
              onChange={(e) => setLlm((l) => ({ ...l, anthropic: { ...l.anthropic, judgeModel: e.target.value } }))}
              spellCheck={false}
            />
          </Field>
          <Field label={t.settings.llm.model} help={t.settings.llm.mainModelHelp} htmlFor="anthropic-model">
            <Input
              id="anthropic-model"
              value={llm.anthropic.model}
              onChange={(e) => setLlm((l) => ({ ...l, anthropic: { ...l.anthropic, model: e.target.value } }))}
              spellCheck={false}
            />
          </Field>
        </div>
      )}

      {llm.provider === 'openai' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.settings.llm.baseUrl} htmlFor="openai-url">
            <Input
              id="openai-url"
              value={llm.openai.baseUrl}
              onChange={(e) => setLlm((l) => ({ ...l, openai: { ...l.openai, baseUrl: e.target.value } }))}
              spellCheck={false}
            />
          </Field>
          <Field label={t.settings.llm.model} htmlFor="openai-model">
            <Input
              id="openai-model"
              placeholder="ex. gpt-4o-mini, mistral-small-latest…"
              value={llm.openai.model}
              onChange={(e) => setLlm((l) => ({ ...l, openai: { ...l.openai, model: e.target.value } }))}
              spellCheck={false}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t.settings.llm.apiKey} help={t.settings.llm.apiKeyHelp} htmlFor="openai-key">
              <Input
                id="openai-key"
                type="password"
                value={llm.openai.apiKey}
                onChange={(e) => setLlm((l) => ({ ...l, openai: { ...l.openai, apiKey: e.target.value } }))}
                autoComplete="off"
              />
            </Field>
          </div>
        </div>
      )}

      {llm.provider === 'ollama' && (
        <>
          <Alert tone="info">{t.settings.llm.ollamaHelp}</Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.settings.llm.baseUrl} htmlFor="ollama-url">
              <Input
                id="ollama-url"
                value={llm.ollama.baseUrl}
                onChange={(e) => setLlm((l) => ({ ...l, ollama: { ...l.ollama, baseUrl: e.target.value } }))}
                spellCheck={false}
              />
            </Field>
            <Field label={t.settings.llm.model} htmlFor="ollama-model">
              <Input
                id="ollama-model"
                list="ollama-models"
                value={llm.ollama.model}
                onChange={(e) => setLlm((l) => ({ ...l, ollama: { ...l.ollama, model: e.target.value } }))}
                spellCheck={false}
              />
              <datalist id="ollama-models">
                {ollamaModels.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
          </div>
          {ollamaModels.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.settings.llm.installedModels} {ollamaModels.join(', ')}
            </p>
          )}
        </>
      )}

      {llm.provider !== 'none' && (
        <div className="space-y-3">
          <Button onClick={runTest} loading={test.state === 'testing'} icon={<KeyRound className="size-4" />}>
            {test.state === 'testing' ? t.settings.llm.testing : t.settings.llm.test}
          </Button>
          {test.state === 'ok' && <Alert tone="success">{test.message}</Alert>}
          {test.state === 'error' && <Alert tone="error">{test.message}</Alert>}
        </div>
      )}
    </Section>
  )
}

/* ────────────────────────────── Voice ────────────────────────────── */

function VoiceSection() {
  const [settings, update] = useSettings()
  const voices = useVoices()
  const availability = useVoiceAvailability()
  const setVoice = (patch: Partial<SettingsShape['voice']>) => update((s) => ({ ...s, voice: { ...s.voice, ...patch } }))
  const setSession = (patch: Partial<SettingsShape['session']>) => update((s) => ({ ...s, session: { ...s.session, ...patch } }))

  const picker = (lang: SpeechLang, key: 'enVoice' | 'frVoice', label: string, sample: string) => {
    const list = voices.length ? voicesFor(lang) : []
    return (
      <Field label={label} htmlFor={key}>
        <div className="flex gap-2">
          <Select id={key} value={settings.voice[key]} onChange={(e) => setVoice({ [key]: e.target.value })}>
            <option value="">{t.settings.voice.auto}</option>
            {list.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </Select>
          <Button
            onClick={() => void speak(sample, lang, { rate: settings.voice.rate, voiceURI: settings.voice[key] })}
            icon={<Volume2 className="size-4" />}
            aria-label={`${t.settings.voice.testEn} — ${label}`}
          >
            <span className="hidden sm:inline">{t.settings.voice.testEn}</span>
          </Button>
        </div>
      </Field>
    )
  }

  return (
    <Section id="voice" icon={<Volume2 className="size-5" />} title={t.settings.voice.title}>
      {availability && !availability.en && <Alert tone="warning">{t.settings.voice.noVoice['en-US']}</Alert>}
      {availability && !availability.fr && <Alert tone="warning">{t.settings.voice.noVoice['fr-FR']}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        {picker('en-US', 'enVoice', t.settings.voice.enVoice, t.settings.voice.sampleEn)}
        {picker('fr-FR', 'frVoice', t.settings.voice.frVoice, t.settings.voice.sampleFr)}
      </div>
      <Field label={`${t.settings.voice.rate} : ${settings.voice.rate.toFixed(2)}×`} htmlFor="rate">
        <input
          id="rate"
          type="range"
          min={0.6}
          max={1.3}
          step={0.05}
          value={settings.voice.rate}
          onChange={(e) => setVoice({ rate: Number(e.target.value) })}
          className="w-full cursor-pointer accent-violet-600"
        />
      </Field>
      <div className="divide-y divide-slate-200 dark:divide-white/10">
        <Toggle checked={settings.voice.muted} onChange={(muted) => setVoice({ muted })} label={t.settings.voice.muted} />
        <Toggle checked={settings.session.autoSpeak} onChange={(autoSpeak) => setSession({ autoSpeak })} label={t.settings.voice.autoSpeak} />
        <Toggle checked={settings.session.autoListen} onChange={(autoListen) => setSession({ autoListen })} label={t.settings.voice.autoListen} />
      </div>
      <Alert tone="warning">{t.settings.voice.limits}</Alert>
    </Section>
  )
}

/* ────────────────────────────── Appearance ────────────────────────────── */

function AppearanceSection() {
  const [settings, update] = useSettings()
  return (
    <Section id="appearance" icon={<Palette className="size-5" />} title={t.settings.appearance.title}>
      <Segmented<Theme>
        label={t.settings.appearance.theme}
        value={settings.theme}
        onChange={(theme) => update((s) => ({ ...s, theme }))}
        options={(['system', 'light', 'dark'] as Theme[]).map((value) => ({ value, label: t.settings.appearance.themes[value] }))}
      />
    </Section>
  )
}
