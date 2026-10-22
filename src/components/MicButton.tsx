import { LoaderCircle, Mic, Square } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { t } from '../i18n'
import { cx } from './ui'

export type MicStatus = 'idle' | 'listening' | 'checking'

/**
 * The big round microphone. While listening it turns rose, pulses and shows a
 * live equaliser so the learner always knows the app is hearing them.
 */
export function MicButton({
  status,
  onStart,
  onStop,
  disabled,
}: {
  status: MicStatus
  onStart: () => void
  onStop: () => void
  disabled?: boolean
}) {
  const listening = status === 'listening'
  const checking = status === 'checking'
  const label = listening ? t.quiz.mic.stop : checking ? t.quiz.mic.checking : t.quiz.mic.start

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative grid size-32 place-items-center">
        <AnimatePresence>
          {listening &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute inset-0 rounded-full border-2 border-rose-400/60"
                initial={{ scale: 0.75, opacity: 0.7 }}
                animate={{ scale: 1.55, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
              />
            ))}
        </AnimatePresence>
        <motion.button
          type="button"
          onClick={listening ? onStop : onStart}
          disabled={disabled || checking}
          aria-label={label}
          aria-pressed={listening}
          whileTap={{ scale: 0.94 }}
          animate={{ scale: listening ? 1.06 : 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className={cx(
            'relative grid size-24 cursor-pointer place-items-center rounded-full text-white shadow-2xl transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60',
            listening
              ? 'bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-500/40'
              : 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-600/40 hover:shadow-violet-500/60',
          )}
        >
          {checking ? (
            <LoaderCircle className="size-9 animate-spin" aria-hidden />
          ) : listening ? (
            <Equalizer />
          ) : (
            <Mic className="size-9" aria-hidden />
          )}
          {listening && <Square className="absolute right-1 bottom-1 size-5 rounded-md bg-white/20 p-1" aria-hidden />}
        </motion.button>
      </div>
      <p
        aria-live="polite"
        className={cx(
          'text-sm font-semibold',
          listening ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400',
        )}
      >
        {label}
      </p>
    </div>
  )
}

function Equalizer() {
  return (
    <span className="flex h-9 items-center gap-1" aria-hidden>
      {[0.5, 0.9, 0.65, 1, 0.55].map((peak, i) => (
        <motion.span
          key={i}
          className="w-1.5 rounded-full bg-white"
          animate={{ height: ['30%', `${peak * 100}%`, '40%', `${peak * 80}%`, '30%'] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}
