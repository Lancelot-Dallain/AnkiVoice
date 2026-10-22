import { Check, CircleAlert, House, LoaderCircle, RotateCcw, Sparkles, X } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Alert, Button, Card, cx } from '../components/ui'
import { t } from '../i18n'
import { type CardResult, summarize } from '../lib/grading'

export type SyncStatus = 'pending' | 'ok' | 'failed'

export function Summary({
  results,
  source,
  sync,
  onRetrySync,
  onAgain,
  onHome,
}: {
  results: CardResult[]
  source: 'demo' | 'anki'
  sync: Record<number, SyncStatus>
  onRetrySync: () => void
  onAgain: () => void
  onHome: () => void
}) {
  const summary = summarize(results)
  const statuses = results.map((r) => sync[r.card.id]).filter(Boolean)
  const pending = statuses.filter((s) => s === 'pending').length
  const failed = statuses.filter((s) => s === 'failed').length
  const ok = statuses.filter((s) => s === 'ok').length

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-12 sm:pt-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="p-6 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <ScoreRing value={summary.successRate} />
            <h1 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">{t.summary.title}</h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">{t.summary.score(summary.succeeded.length, summary.total)}</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Column title={t.summary.succeeded} tone="success" icon={<Check className="size-4" strokeWidth={3} />} items={summary.succeeded} />
            <Column title={t.summary.toReview} tone="warning" icon={<RotateCcw className="size-4" strokeWidth={3} />} items={summary.toReview} />
            <Column title={t.summary.missed} tone="danger" icon={<X className="size-4" strokeWidth={3} />} items={summary.missed} />
          </div>

          <div className="mt-6">
            {source === 'demo' ? (
              <Alert tone="info">{t.summary.sync.demo}</Alert>
            ) : pending > 0 ? (
              <Alert tone="info">
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="size-4 animate-spin" /> {t.summary.sync.pending}
                </span>
              </Alert>
            ) : failed > 0 ? (
              <Alert
                tone="error"
                action={
                  <Button size="sm" onClick={onRetrySync}>
                    {t.summary.sync.retry}
                  </Button>
                }
              >
                {t.summary.sync.failed(failed)}
              </Alert>
            ) : (
              ok > 0 && <Alert tone="success">{t.summary.sync.ok(ok)}</Alert>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="primary" size="lg" onClick={onAgain} icon={<RotateCcw className="size-5" />}>
              {t.summary.again}
            </Button>
            <Button size="lg" onClick={onHome} icon={<House className="size-5" />}>
              {t.summary.home}
            </Button>
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-500 dark:text-slate-400">
            <Sparkles className="size-3.5 text-violet-500" /> {t.summary.next}
          </p>
        </Card>
      </motion.div>
    </div>
  )
}

const TONES = {
  success: { head: 'text-emerald-600 dark:text-emerald-300', dot: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' },
  warning: { head: 'text-amber-600 dark:text-amber-300', dot: 'bg-amber-500/15 text-amber-600 dark:text-amber-300' },
  danger: { head: 'text-rose-600 dark:text-rose-300', dot: 'bg-rose-500/15 text-rose-600 dark:text-rose-300' },
}

function Column({ title, tone, icon, items }: { title: string; tone: keyof typeof TONES; icon: ReactNode; items: CardResult[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <div className={cx('mb-3 flex items-center gap-2 text-sm font-bold', TONES[tone].head)}>
        <span className={cx('grid size-6 place-items-center rounded-full', TONES[tone].dot)}>{icon}</span>
        {title}
        <span className="ml-auto tabular-nums opacity-70">{items.length}</span>
      </div>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.card.id} className="text-sm leading-snug">
              <span className="font-semibold">{r.card.english}</span>
              <span className="text-slate-500 dark:text-slate-400"> — {r.card.french}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
          <CircleAlert className="size-3.5" /> {t.summary.empty}
        </p>
      )}
    </div>
  )
}

function ScoreRing({ value }: { value: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative grid size-36 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="score" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-slate-900/[0.06] dark:stroke-white/10" />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#score)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - value) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <span className="font-display text-4xl font-bold tabular-nums">{Math.round(value * 100)}%</span>
    </div>
  )
}
