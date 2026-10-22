import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/25 hover:shadow-violet-600/40 hover:brightness-110',
  secondary:
    'border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10',
  ghost: 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-xl px-3 text-sm',
  md: 'h-11 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-13 gap-2.5 rounded-2xl px-6 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-3xl border border-slate-200/80 bg-white/80 shadow-xl shadow-slate-900/[0.03] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20',
        className,
      )}
    >
      {children}
    </div>
  )
}

const BADGE_TONES = {
  neutral: 'bg-slate-900/5 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  brand: 'bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200',
  success: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200',
  warning: 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200',
  danger: 'bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200',
} as const

export type Tone = keyof typeof BADGE_TONES

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', BADGE_TONES[tone], className)}>
      {children}
    </span>
  )
}

const ALERT_STYLES = {
  info: { box: 'border-sky-500/20 bg-sky-500/5 text-sky-900 dark:text-sky-100', icon: Info, color: 'text-sky-500' },
  success: {
    box: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100',
    icon: CircleCheck,
    color: 'text-emerald-500',
  },
  warning: {
    box: 'border-amber-500/25 bg-amber-500/5 text-amber-900 dark:text-amber-100',
    icon: TriangleAlert,
    color: 'text-amber-500',
  },
  error: { box: 'border-rose-500/25 bg-rose-500/5 text-rose-900 dark:text-rose-100', icon: CircleX, color: 'text-rose-500' },
} as const

export function Alert({
  tone,
  children,
  action,
  className,
}: {
  tone: keyof typeof ALERT_STYLES
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  const style = ALERT_STYLES[tone]
  const Icon = style.icon
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-2xl border p-3.5 text-sm', style.box, className)}>
      <Icon className={cx('mt-0.5 size-4 shrink-0', style.color)} aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
      {action}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: Array<{ value: T; label: ReactNode }>
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('inline-flex flex-wrap gap-1 rounded-2xl bg-slate-900/5 p-1 dark:bg-white/[0.06]', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex-1 cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition-all',
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-700 dark:text-slate-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
          checked ? 'bg-violet-600' : 'bg-slate-300 dark:bg-white/15',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </label>
  )
}

export function Field({ label, help, children, htmlFor }: { label: ReactNode; help?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {children}
      {help && <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{help}</p>}
    </div>
  )
}

const CONTROL =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL, className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(CONTROL, 'cursor-pointer appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9 dark:[&>option]:bg-slate-900', className)} style={{ backgroundImage: CHEVRON }} {...rest}>
      {children}
    </select>
  )
}

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 font-sans text-[11px] font-semibold text-slate-600 dark:border-white/15 dark:bg-white/10 dark:text-slate-300">
      {children}
    </kbd>
  )
}
