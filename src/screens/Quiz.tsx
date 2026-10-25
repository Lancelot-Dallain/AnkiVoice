import { ArrowRight, BookmarkPlus, Check, Ear, Keyboard, Lightbulb, Mic, ThumbsUp, Volume2, VolumeX, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type Dispatch, type FormEvent, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { MicButton, type MicStatus } from '../components/MicButton'
import { Alert, Badge, Button, Card, cx, Input, Kbd, type Tone } from '../components/ui'
import { t } from '../i18n'
import { addAcceptedAnswer } from '../lib/anki/cards'
import { AnkiConnectClient } from '../lib/anki/client'
import { judgeAnswer } from '../lib/judge'
import { createProvider, type LlmProvider } from '../lib/llm'
import {
  answerToSay,
  type Attempt,
  canPlayAnswer,
  createSession,
  type SessionAction,
  sessionReducer,
  type SessionState,
} from '../lib/session'
import type { Settings } from '../lib/settings'
import {
  isRecognitionSupported,
  type ListenErrorCode,
  type ListenHandle,
  listenOnce,
  speak,
  type SpeechLang,
  stopSpeaking,
} from '../lib/speech'
import { answerLang, hintFor, maskInExample } from '../lib/text'
import { useSettings, useVoiceAvailability } from '../state'
import type { Direction, Ease, StudyCard } from '../types'
import { Summary, type SyncStatus } from './Summary'

export interface ActiveSession {
  /** Changes on every new session so React starts fresh. */
  key: number
  source: 'demo' | 'anki'
  deck?: string
  cards: StudyCard[]
  directions: Direction[]
}

type InputMode = 'voice' | 'keyboard'

export function Quiz({ session, onExit, onRestart }: { session: ActiveSession; onExit: () => void; onRestart: () => void }) {
  const [settings, update] = useSettings()
  const voices = useVoiceAvailability()
  const [state, dispatch] = useReducer(sessionReducer, session, (s) => createSession(s.cards, s.directions))
  const [stoppedEarly, setStoppedEarly] = useState(false)
  const [sync, setSync] = useState<Record<number, SyncStatus>>({})
  const [mode, setMode] = useState<InputMode>(() => (isRecognitionSupported() ? 'voice' : 'keyboard'))

  const provider = useMemo(() => {
    try {
      return createProvider(settings.llm)
    } catch {
      return null // incomplete AI settings: fall back on the offline judge
    }
  }, [settings.llm])

  const anki = useMemo(
    () => (session.source === 'anki' ? new AnkiConnectClient({ url: settings.anki.url, apiKey: settings.anki.apiKey }) : null),
    [session.source, settings.anki.url, settings.anki.apiKey],
  )

  const sendGrade = useCallback(
    async (cardId: number, ease: Ease) => {
      if (!anki || cardId <= 0) return
      setSync((s) => ({ ...s, [cardId]: 'pending' }))
      try {
        const [ok] = await anki.answerCards([{ cardId, ease }])
        setSync((s) => ({ ...s, [cardId]: ok ? 'ok' : 'failed' }))
      } catch {
        setSync((s) => ({ ...s, [cardId]: 'failed' }))
      }
    },
    [anki],
  )

  /** Adds an answer the learner defended to the card in Anki (real sessions only). */
  const addAnswer = useCallback(
    (card: StudyCard, direction: Direction, answer: string) => {
      const field = direction === 'en-fr' ? settings.anki.mapping.french : settings.anki.mapping.english
      if (!anki || card.id <= 0 || !field) return Promise.reject(new Error('Not available'))
      return addAcceptedAnswer(anki, card.id, field, answer, answerLang(direction))
    },
    [anki, settings.anki.mapping],
  )

  const current = state.phase === 'done' ? null : state.cards[state.index]

  if (!current || stoppedEarly) {
    return (
      <Summary
        results={state.results}
        source={session.source}
        sync={sync}
        onRetrySync={() =>
          state.results.filter((r) => sync[r.card.id] === 'failed').forEach((r) => void sendGrade(r.card.id, r.ease))
        }
        onAgain={onRestart}
        onHome={onExit}
      />
    )
  }

  const next = () => {
    if (state.ease) void sendGrade(current.id, state.ease)
    dispatch({ type: 'next' })
  }

  const quit = () => {
    stopSpeaking()
    if (state.results.length) setStoppedEarly(true)
    else onExit()
  }

  const progress = (state.index + (state.phase === 'reveal' ? 1 : 0)) / state.cards.length

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-10 sm:pt-8">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={quit} icon={<X className="size-4" />} aria-label={t.quiz.quit}>
          <span className="hidden sm:inline">{t.quiz.quit}</span>
        </Button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
            initial={false}
            animate={{ width: `${Math.max(progress * 100, 3)}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (!settings.voice.muted) stopSpeaking()
            update((s) => ({ ...s, voice: { ...s.voice, muted: !s.voice.muted } }))
          }}
          className="grid size-9 cursor-pointer place-items-center rounded-xl text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label={settings.voice.muted ? t.quiz.unmute : t.quiz.mute}
          title={settings.voice.muted ? t.quiz.unmute : t.quiz.mute}
          aria-pressed={settings.voice.muted}
        >
          {settings.voice.muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
        </button>
        <span className="text-sm font-semibold text-slate-500 tabular-nums dark:text-slate-400">
          {t.quiz.progress(state.index + 1, state.cards.length)}
        </span>
        {session.source === 'demo' ? (
          <Badge tone="brand">{t.quiz.demo}</Badge>
        ) : (
          session.deck && (
            <Badge className="hidden max-w-36 truncate sm:inline-flex" tone="neutral">
              {session.deck}
            </Badge>
          )
        )}
      </div>

      {voices && !settings.voice.muted && (!voices.en || !voices.fr) && (
        <Alert tone="warning" className="mb-4">
          {!voices.en ? t.quiz.noVoice['en-US'] : t.quiz.noVoice['fr-FR']}{' '}
          <a href="#/settings" className="font-semibold underline">
            {t.quiz.howToFix}
          </a>
        </Alert>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={state.index}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <QuizCard
            card={current}
            direction={state.directions[state.index]}
            state={state}
            dispatch={dispatch}
            provider={provider}
            settings={settings}
            mode={mode}
            setMode={setMode}
            demo={session.source === 'demo'}
            canHearEnglish={!settings.voice.muted && voices?.en !== false}
            isLast={state.index === state.cards.length - 1}
            onAddAnswer={anki ? addAnswer : undefined}
            onNext={next}
          />
        </motion.div>
      </AnimatePresence>

      <p className="mt-5 hidden text-center text-xs text-slate-400 sm:block dark:text-slate-500">
        <Kbd>Entrée</Kbd> {t.quiz.shortcuts.enter} · <Kbd>1</Kbd>–<Kbd>4</Kbd> {t.quiz.shortcuts.grade} · <Kbd>E</Kbd>{' '}
        {t.quiz.shortcuts.listen} ·{' '}
        <Kbd>Espace</Kbd> {t.quiz.shortcuts.mic}
      </p>
    </div>
  )
}

const MIC_ERRORS: Record<ListenErrorCode, string> = {
  unsupported: t.quiz.mic.unsupported,
  'not-allowed': t.quiz.mic.denied,
  'no-speech': t.quiz.mic.noSpeech,
  network: t.quiz.mic.network,
  aborted: '',
  other: t.quiz.mic.error,
}

interface QuizCardProps {
  card: StudyCard
  direction: Direction
  state: SessionState
  dispatch: Dispatch<SessionAction>
  provider: LlmProvider | null
  settings: Settings
  mode: InputMode
  setMode: (mode: InputMode) => void
  demo: boolean
  /** False when muted or no English voice: the English word is then shown written. */
  canHearEnglish: boolean
  isLast: boolean
  onNext: () => void
  /** Present in real Anki sessions: write a defended answer back into the card. */
  onAddAnswer?: (card: StudyCard, direction: Direction, answer: string) => Promise<'added' | 'present'>
}

function QuizCard({
  card,
  direction,
  state,
  dispatch,
  provider,
  settings,
  mode,
  setMode,
  demo,
  canHearEnglish,
  isLast,
  onNext,
  onAddAnswer,
}: QuizCardProps) {
  const promptLang: SpeechLang = direction === 'en-fr' ? 'en-US' : 'fr-FR'
  const replyLang: SpeechLang = direction === 'en-fr' ? 'fr-FR' : 'en-US'
  const promptText = direction === 'en-fr' ? card.english : card.french

  const [mic, setMic] = useState<MicStatus>('idle')
  const [interim, setInterim] = useState('')
  const [micError, setMicError] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const listenRef = useRef<ListenHandle | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const say = useCallback(
    (text: string, lang: SpeechLang) =>
      speak(text, lang, {
        rate: settings.voice.rate,
        muted: settings.voice.muted,
        voiceURI: lang === 'en-US' ? settings.voice.enVoice : settings.voice.frVoice,
      }),
    [settings.voice],
  )

  const [answerVoiceMissing, setAnswerVoiceMissing] = useState(false)
  /** Reads the expected answer with a voice of its language. Never changes the grade. */
  const playAnswer = useCallback(async () => {
    if (!canPlayAnswer(state)) return
    const { text, lang } = answerToSay(card, direction)
    // An explicit click plays even when automatic reading is muted.
    const result = await speak(text, lang, {
      rate: settings.voice.rate,
      voiceURI: lang === 'en-US' ? settings.voice.enVoice : settings.voice.frVoice,
    })
    setAnswerVoiceMissing(result === 'no-voice')
  }, [state, card, direction, settings.voice])

  const submit = async (candidates: string[], via: 'voice' | 'keyboard') => {
    setBusy(true)
    setMicError('')
    if (via === 'voice') setMic('checking')
    const controller = new AbortController()
    abortRef.current = controller
    let verdict
    try {
      verdict = await judgeAnswer(
        { direction, english: card.english, french: card.french, example: card.example, kind: card.kind, candidates, via },
        provider,
        t.quiz.judge,
        controller.signal,
      )
    } catch {
      return // card left while the AI was thinking
    }
    setBusy(false)
    setMic('idle')
    setTyped('')
    setInterim('')
    const alternatives = via === 'voice' ? [...new Set(candidates.slice(1))].filter((c) => c !== candidates[0]) : undefined
    dispatch({ type: 'answered', attempt: { text: candidates[0] ?? '', via, verdict, alternatives } })
  }

  const startListening = () => {
    stopSpeaking()
    setMicError('')
    setInterim('')
    const handle = listenOnce(replyLang, setInterim)
    listenRef.current = handle
    setMic('listening')
    handle.result.then(
      (alternatives) => {
        if (listenRef.current !== handle) return
        listenRef.current = null
        void submit(alternatives, 'voice')
      },
      (error: { code?: ListenErrorCode }) => {
        if (listenRef.current !== handle) return
        listenRef.current = null
        setMic('idle')
        const code = error.code ?? 'other'
        setMicError(MIC_ERRORS[code])
        if (code === 'not-allowed' || code === 'unsupported' || code === 'network') setMode('keyboard')
      },
    )
  }

  const stopListening = () => listenRef.current?.stop()

  /** "That's not what I said": forget the misheard answer and listen again. */
  const relisten = () => {
    dispatch({ type: 'retract' })
    startListening()
  }

  // Read the card aloud when it appears (and optionally open the mic).
  useEffect(() => {
    let cancelled = false
    if (settings.session.autoSpeak) {
      void say(promptText, promptLang).then(() => {
        if (!cancelled && settings.session.autoListen && mode === 'voice') startListening()
      })
    }
    return () => {
      cancelled = true
      const handle = listenRef.current
      listenRef.current = null
      handle?.abort()
      abortRef.current?.abort()
      stopSpeaking()
    }
    // Only when the card mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Say the English word on reveal so the learner hears the right pronunciation.
  useEffect(() => {
    if (state.phase === 'reveal' && settings.session.autoSpeak) void say(card.english, 'en-US')
  }, [state.phase, settings.session.autoSpeak, say, card.english])

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const inField = !!target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (state.phase === 'reveal') {
        if (!inField && ['1', '2', '3', '4'].includes(event.key)) {
          dispatch({ type: 'set-ease', ease: Number(event.key) as Ease })
        } else if (!inField && (event.key === 'e' || event.key === 'E') && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          void playAnswer()
        } else if (event.key === 'Enter') {
          event.preventDefault()
          onNext()
        }
      } else if (mode === 'voice' && !inField && event.key === ' ' && !busy) {
        event.preventDefault()
        if (mic === 'listening') stopListening()
        else if (mic === 'idle') startListening()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onType = (event: FormEvent) => {
    event.preventDefault()
    if (typed.trim() && !busy) void submit([typed.trim()], 'keyboard')
  }

  const retry = state.stage === 'retry'
  const reveal = state.phase === 'reveal'
  const lastAttempt = state.attempts[state.attempts.length - 1]

  return (
    <Card className="overflow-hidden">
      <div className="p-6 sm:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <Badge tone={card.kind === 'vocabulary' ? 'brand' : card.kind === 'grammar' ? 'warning' : 'success'}>
            {t.quiz.kinds[card.kind]}
          </Badge>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {reveal ? '' : retry ? t.quiz.retryInstruction[direction] : t.quiz.instruction[direction]}
          </span>
        </div>

        {/* ── Prompt ─────────────────────────────────────── */}
        <div className="flex min-h-36 flex-col items-center justify-center text-center">
          {direction === 'en-fr' && !retry && !reveal && canHearEnglish ? (
            <>
              <motion.button
                type="button"
                onClick={() => void say(card.english, 'en-US')}
                whileTap={{ scale: 0.95 }}
                className="group grid size-20 cursor-pointer place-items-center rounded-full bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-violet-600 ring-1 ring-violet-500/20 transition hover:ring-violet-500/50 dark:text-violet-200"
                aria-label={t.quiz.replay}
              >
                <Volume2 className="size-9 transition group-hover:scale-110" />
              </motion.button>
              <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">{t.quiz.hidden}</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                  {direction === 'en-fr' ? card.english : card.french}
                </h2>
                <button
                  type="button"
                  onClick={() => void say(promptText, promptLang)}
                  className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-slate-400 transition hover:bg-slate-900/5 hover:text-violet-600 dark:hover:bg-white/10 dark:hover:text-violet-300"
                  aria-label={direction === 'en-fr' ? t.quiz.replay : t.quiz.listenFrench}
                >
                  <Volume2 className="size-5" />
                </button>
              </div>
              {direction === 'en-fr' && !retry && !reveal && (
                <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">{settings.voice.muted ? t.quiz.mutedHint : t.quiz.noVoiceHint}</p>
              )}
              {direction === 'en-fr' && card.example && (retry || reveal) && (
                <p className="mt-3 max-w-md text-base text-slate-500 italic dark:text-slate-400">« {card.example} »</p>
              )}
              {direction === 'fr-en' && retry && !reveal && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <Badge tone="warning">
                    <Lightbulb className="size-3.5" />
                    {t.quiz.hint(hintFor(card.english).first, hintFor(card.english).letters)}
                  </Badge>
                  {card.example && (
                    <p className="max-w-md text-base text-slate-500 italic dark:text-slate-400">
                      « {maskInExample(card.example, card.english)} »
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Answer or reveal ───────────────────────────── */}
        <div className="mt-8">
          {reveal ? (
            <Reveal
              card={card}
              direction={direction}
              state={state}
              dispatch={dispatch}
              demo={demo}
              isLast={isLast}
              onNext={onNext}
              onAddAnswer={onAddAnswer}
              onRelisten={relisten}
              onPlayAnswer={canPlayAnswer(state) ? playAnswer : undefined}
              answerVoiceMissing={answerVoiceMissing}
            />
          ) : (
            <div className="flex flex-col items-center gap-5">
              {retry && lastAttempt && (
                <Alert tone="warning" className="w-full">
                  <strong>{t.quiz.firstWrong}</strong>{' '}
                  {lastAttempt.text && (
                    <>
                      {lastAttempt.via === 'voice' ? t.quiz.heard : t.quiz.typed} « {lastAttempt.text} ».{' '}
                    </>
                  )}
                  <Alternatives attempt={lastAttempt} />
                  {lastAttempt.verdict.source === 'llm' && lastAttempt.verdict.feedback}
                  {lastAttempt.verdict.source === 'local' && lastAttempt.text && (
                    <span className="mt-1 block text-xs opacity-80">{provider ? t.quiz.judge.llmFailed : t.quiz.noAiHint}</span>
                  )}
                  {lastAttempt.via === 'voice' && (
                    <Button size="sm" variant="secondary" className="mt-2 mr-2" icon={<Ear className="size-4" />} onClick={relisten}>
                      {t.quiz.notWhatISaid}
                    </Button>
                  )}
                  {lastAttempt.text && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      icon={<ThumbsUp className="size-4" />}
                      onClick={() => {
                        listenRef.current?.abort()
                        listenRef.current = null
                        setMic('idle')
                        dispatch({ type: 'overrule', feedback: t.quiz.overruled })
                      }}
                    >
                      {t.quiz.iWasRight}
                    </Button>
                  )}
                </Alert>
              )}

              {mode === 'voice' ? (
                <>
                  <MicButton status={mic} onStart={startListening} onStop={stopListening} disabled={busy && mic !== 'checking'} />
                  <div className="min-h-8 text-center" aria-live="polite">
                    {interim && (
                      <p className="font-display text-2xl font-semibold text-slate-700 dark:text-slate-200">« {interim} »</p>
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={onType} className="flex w-full max-w-md gap-2">
                  <Input
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={t.quiz.placeholder[direction]}
                    lang={replyLang}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="h-12 text-base"
                    aria-label={t.quiz.placeholder[direction]}
                  />
                  <Button type="submit" variant="primary" className="h-12" loading={busy} disabled={!typed.trim()}>
                    {t.quiz.submit}
                  </Button>
                </form>
              )}

              {micError && (
                <Alert tone="info" className="w-full">
                  {micError}
                </Alert>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2">
                {mode === 'voice' ? (
                  <Button variant="ghost" size="sm" icon={<Keyboard className="size-4" />} onClick={() => setMode('keyboard')}>
                    {t.quiz.keyboard}
                  </Button>
                ) : (
                  isRecognitionSupported() && (
                    <Button variant="ghost" size="sm" icon={<Mic className="size-4" />} onClick={() => setMode('voice')}>
                      {t.quiz.voice}
                    </Button>
                  )
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    listenRef.current?.abort()
                    listenRef.current = null
                    setMic('idle')
                    dispatch({ type: 'give-up' })
                  }}
                >
                  {t.quiz.giveUp}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

const OUTCOME_STYLE = {
  first: { tone: 'success' as Tone, ring: 'from-emerald-400 to-teal-400', icon: Check },
  retry: { tone: 'warning' as Tone, ring: 'from-amber-400 to-orange-400', icon: Check },
  missed: { tone: 'danger' as Tone, ring: 'from-rose-400 to-pink-500', icon: X },
}

const EASE_STYLE: Record<Ease, string> = {
  1: 'data-[on=true]:border-rose-500 data-[on=true]:bg-rose-500/10 data-[on=true]:text-rose-700 dark:data-[on=true]:text-rose-200',
  2: 'data-[on=true]:border-amber-500 data-[on=true]:bg-amber-500/10 data-[on=true]:text-amber-700 dark:data-[on=true]:text-amber-200',
  3: 'data-[on=true]:border-emerald-500 data-[on=true]:bg-emerald-500/10 data-[on=true]:text-emerald-700 dark:data-[on=true]:text-emerald-200',
  4: 'data-[on=true]:border-sky-500 data-[on=true]:bg-sky-500/10 data-[on=true]:text-sky-700 dark:data-[on=true]:text-sky-200',
}

function Reveal({
  card,
  direction,
  state,
  dispatch,
  demo,
  isLast,
  onNext,
  onAddAnswer,
  onRelisten,
  onPlayAnswer,
  answerVoiceMissing,
}: Pick<QuizCardProps, 'card' | 'direction' | 'state' | 'dispatch' | 'demo' | 'isLast' | 'onNext' | 'onAddAnswer'> & {
  onRelisten: () => void
  /** Present only once the answer is revealed. */
  onPlayAnswer?: () => void
  answerVoiceMissing: boolean
}) {
  const outcome = state.outcome ?? 'missed'
  const style = OUTCOME_STYLE[outcome]
  const Icon = style.icon
  const last = state.attempts[state.attempts.length - 1]
  const [teach, setTeach] = useState<'idle' | 'saving' | 'added' | 'present' | 'error'>('idle')
  const canOverrule = outcome === 'missed' && !!last && !last.verdict.correct && !!last.text.trim()

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <motion.span
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className={cx('grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br text-white shadow-lg', style.ring)}
        >
          <Icon className="size-6" strokeWidth={3} />
        </motion.span>
        <div>
          <p className="font-display text-xl font-bold">{t.quiz.outcomes[outcome][direction]}</p>
          {last?.verdict.feedback && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {last.verdict.source === 'llm' && <span className="font-semibold">{t.quiz.judge.byAi} : </span>}
              {last.verdict.feedback}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl bg-slate-900/[0.03] p-4 sm:grid-cols-2 dark:bg-white/[0.04]">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{t.quiz.english}</p>
          <p className="mt-1 text-lg font-semibold">{card.english}</p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{t.quiz.french}</p>
          <p className="mt-1 text-lg font-semibold">{card.french}</p>
        </div>
        {card.example && direction === 'fr-en' && (
          <p className="text-sm text-slate-500 italic sm:col-span-2 dark:text-slate-400">« {card.example} »</p>
        )}
        {onPlayAnswer && (
          <div className="sm:col-span-2">
            <Button
              size="sm"
              icon={<Volume2 className="size-4" />}
              onClick={onPlayAnswer}
              title={t.quiz.playAnswerTitle}
              aria-keyshortcuts="E"
            >
              {t.quiz.playAnswer}
            </Button>
            {answerVoiceMissing && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                {t.quiz.noVoice[answerToSay(card, direction).lang]}
              </p>
            )}
          </div>
        )}
      </div>

      {state.attempts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">{t.quiz.yourAnswers} :</span>
          {state.attempts.map((attempt, i) => (
            <Badge key={i} tone={attempt.verdict.correct ? 'success' : 'danger'}>
              {attempt.verdict.correct ? <Check className="size-3" /> : <X className="size-3" />}
              {attempt.text || '—'}
            </Badge>
          ))}
          {last && <Alternatives attempt={last} className="w-full" />}
        </div>
      )}

      {last?.verdict.llmError && <p className="text-xs text-amber-600 dark:text-amber-300">{t.quiz.judge.llmFailed}</p>}

      {canOverrule && (
        <div className="flex flex-wrap gap-2">
          {last.via === 'voice' && (
            <Button size="sm" icon={<Ear className="size-4" />} onClick={onRelisten}>
              {t.quiz.notWhatISaid}
            </Button>
          )}
          <Button size="sm" icon={<ThumbsUp className="size-4" />} onClick={() => dispatch({ type: 'overrule', feedback: t.quiz.overruled })}>
            {t.quiz.myAnswerWasRight(last.text)}
          </Button>
        </div>
      )}

      {last?.verdict.overruled && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-3 text-sm">
          {onAddAnswer ? (
            teach === 'added' || teach === 'present' ? (
              <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Check className="size-4" /> {teach === 'added' ? t.quiz.teach.added : t.quiz.teach.present}
              </span>
            ) : (
              <>
                <span className="flex-1 text-slate-600 dark:text-slate-300">{t.quiz.teach.why}</span>
                <Button
                  size="sm"
                  loading={teach === 'saving'}
                  icon={<BookmarkPlus className="size-4" />}
                  onClick={async () => {
                    setTeach('saving')
                    try {
                      setTeach(await onAddAnswer(card, direction, last.text))
                    } catch {
                      setTeach('error')
                    }
                  }}
                >
                  {t.quiz.teach.add(last.text)}
                </Button>
                {teach === 'error' && <span className="w-full text-xs text-rose-600 dark:text-rose-300">{t.quiz.teach.error}</span>}
              </>
            )
          ) : (
            <span className="text-slate-600 dark:text-slate-300">{t.quiz.teach.demo}</span>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold">{demo ? t.quiz.gradeDemo : t.quiz.grade}</p>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t.quiz.grade}>
          {([1, 2, 3, 4] as Ease[]).map((ease) => (
            <button
              key={ease}
              type="button"
              role="radio"
              aria-checked={state.ease === ease}
              data-on={state.ease === ease}
              onClick={() => dispatch({ type: 'set-ease', ease })}
              className={cx(
                'flex cursor-pointer flex-col items-center gap-0.5 rounded-xl border-2 border-slate-200 px-1 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20',
                EASE_STYLE[ease],
              )}
            >
              <span>{t.quiz.eases[ease]}</span>
              <span className="text-[11px] font-medium opacity-60">{ease}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.quiz.gradeHelp}</p>
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={onNext} autoFocus>
        {isLast ? t.quiz.finish : t.quiz.next}
        <ArrowRight className="size-5" />
      </Button>
    </motion.div>
  )
}

/** The other hypotheses of the speech recognition, to understand what it heard. */
function Alternatives({ attempt, className }: { attempt: Attempt; className?: string }) {
  if (attempt.via !== 'voice' || !attempt.alternatives?.length) return null
  return (
    <span className={cx('block text-xs text-slate-500 dark:text-slate-400', className)}>
      {t.quiz.alternatives} {attempt.alternatives.map((a) => `« ${a} »`).join(' · ')}
    </span>
  )
}
