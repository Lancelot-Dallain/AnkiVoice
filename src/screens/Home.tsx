import { ArrowRight, Ear, Layers, Mic, Play, Settings2, ShieldCheck, TrendingUp } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Segmented } from '../components/ui'
import { DEMO_DECK } from '../demo/deck'
import { t } from '../i18n'
import { loadDueCards } from '../lib/anki/cards'
import { AnkiConnectClient, AnkiError } from '../lib/anki/client'
import { assignDirections } from '../lib/session'
import { isAnkiReady } from '../lib/settings'
import { isRecognitionSupported } from '../lib/speech'
import { useSettings } from '../state'
import type { DirectionMode, StudyCard } from '../types'
import type { ActiveSession } from './Quiz'

const SIZES = [10, 20, 30, 50]

export function Home({ onStart, navigate }: { onStart: (session: Omit<ActiveSession, 'key'>) => void; navigate: (path: string) => void }) {
  const [settings, update] = useSettings()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const ready = isAnkiReady(settings)
  const { mode, size } = settings.session

  const start = (source: 'demo' | 'anki', cards: StudyCard[]) =>
    onStart({ source, cards, deck: source === 'anki' ? settings.anki.deck : undefined, directions: assignDirections(cards.length, mode) })

  const startAnki = async () => {
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const client = new AnkiConnectClient({ url: settings.anki.url, apiKey: settings.anki.apiKey })
      const cards = await loadDueCards(client, {
        deck: settings.anki.deck,
        mapping: settings.anki.mapping,
        limit: size,
        includeNew: settings.anki.includeNew,
        newLimit: settings.anki.newLimit,
      })
      if (!cards.length) setInfo(t.home.noDue)
      else start('anki', cards)
    } catch (e) {
      const errors = t.settings.anki.errors
      if (e instanceof AnkiError) setError(e.code === 'api' ? errors.api(e.message) : errors[e.code])
      else setError(errors.api(String(e)))
    } finally {
      setLoading(false)
    }
  }

  const setMode = (value: DirectionMode) => update((s) => ({ ...s, session: { ...s.session, mode: value } }))
  const setSize = (value: string) => update((s) => ({ ...s, session: { ...s.session, size: Number(value) } }))

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      {/* Hero */}
      <section className="pt-10 pb-12 text-center sm:pt-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Badge tone="brand" className="mb-6">
            <ShieldCheck className="size-3.5" /> {t.home.badge}
          </Badge>
          <h1 className="mx-auto max-w-3xl font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
            {t.home.title}{' '}
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent dark:from-violet-400 dark:via-fuchsia-400 dark:to-cyan-300">
              {t.home.titleAccent}
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-slate-600 sm:text-lg dark:text-slate-300">
            {t.home.subtitle}
          </p>
        </motion.div>
      </section>

      {!isRecognitionSupported() && (
        <Alert tone="warning" className="mx-auto mb-6 max-w-3xl">
          {t.home.noRecognition}
        </Alert>
      )}

      {/* Two ways to start */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid gap-4 md:grid-cols-2"
      >
        <Card className="group relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -top-16 -right-16 size-48 rounded-full bg-violet-500/20 blur-3xl transition group-hover:bg-violet-500/30" />
          <div className="relative">
            <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-600/30">
              <Play className="size-6" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold">{t.home.demoTitle}</h2>
            <p className="mt-1.5 text-slate-600 dark:text-slate-300">{t.home.demoText(DEMO_DECK.length)}</p>
            <Button variant="primary" size="lg" className="mt-6 w-full sm:w-auto" onClick={() => start('demo', DEMO_DECK)}>
              {t.home.demoCta} <ArrowRight className="size-5" />
            </Button>
          </div>
        </Card>

        <Card className="group relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -top-16 -right-16 size-48 rounded-full bg-cyan-400/20 blur-3xl transition group-hover:bg-cyan-400/30" />
          <div className="relative">
            <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 text-white shadow-lg shadow-cyan-600/30">
              <Layers className="size-6" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold">{t.home.ankiTitle}</h2>
            <p className="mt-1.5 text-slate-600 dark:text-slate-300">
              {ready ? t.home.ankiReady(settings.anki.deck) : t.home.ankiNotReady}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {ready ? (
                <>
                  <Button variant="primary" size="lg" loading={loading} onClick={startAnki} className="w-full sm:w-auto">
                    {loading ? t.home.loading : t.home.ankiCta} {!loading && <ArrowRight className="size-5" />}
                  </Button>
                  <Button size="lg" onClick={() => navigate('/settings')} aria-label={t.nav.settings}>
                    <Settings2 className="size-5" />
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={() => navigate('/settings')} icon={<Settings2 className="size-5" />} className="w-full sm:w-auto">
                  {t.home.ankiSetup}
                </Button>
              )}
            </div>
            {error && (
              <Alert tone="error" className="mt-4">
                {error}
              </Alert>
            )}
            {info && (
              <Alert tone="success" className="mt-4">
                {info}
              </Alert>
            )}
          </div>
        </Card>
      </motion.section>

      {/* Session options */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-4"
      >
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="font-semibold">{t.home.options}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Segmented
              label={t.home.direction}
              value={mode}
              onChange={setMode}
              options={(['en-fr', 'fr-en', 'mixed'] as DirectionMode[]).map((value) => ({ value, label: t.home.directions[value] }))}
            />
            <Segmented
              label={t.home.size}
              value={String(size)}
              onChange={setSize}
              options={SIZES.map((n) => ({ value: String(n), label: n }))}
            />
          </div>
        </Card>
      </motion.section>

      {/* How it works */}
      <section className="mt-16 mb-6">
        <h2 className="mb-6 text-center font-display text-2xl font-bold">{t.home.howTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {t.home.how.map((step, i) => {
            const Icon = [Ear, Mic, TrendingUp][i]
            return (
              <div key={step.title} className="rounded-3xl border border-slate-200/80 p-6 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-display text-sm font-bold text-slate-400">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.text}</p>
              </div>
            )
          })}
        </div>
        <p className="mx-auto mt-8 flex max-w-2xl items-start justify-center gap-2 text-center text-sm text-slate-500 dark:text-slate-400">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          {t.home.privacy}
        </p>
      </section>
    </div>
  )
}
