import { Monitor, Moon, Settings2, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { REPO_URL } from '../config'
import { t } from '../i18n'
import type { Theme } from '../lib/settings'
import { useSettings } from '../state'
import { cx } from './ui'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('flex items-center gap-2.5', className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-500/30">
        <svg viewBox="0 0 24 24" className="size-5 text-white" fill="currentColor" aria-hidden>
          <rect x="3" y="9" width="2.6" height="6" rx="1.3" />
          <rect x="7.4" y="5" width="2.6" height="14" rx="1.3" />
          <rect x="11.8" y="7.5" width="2.6" height="9" rx="1.3" />
          <rect x="16.2" y="3.5" width="2.6" height="17" rx="1.3" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight">{t.app.name}</span>
    </span>
  )
}

const THEME_ORDER: Theme[] = ['system', 'light', 'dark']
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon }

function ThemeButton() {
  const [settings, update] = useSettings()
  const Icon = THEME_ICON[settings.theme]
  const next = THEME_ORDER[(THEME_ORDER.indexOf(settings.theme) + 1) % THEME_ORDER.length]
  return (
    <button
      type="button"
      onClick={() => update((s) => ({ ...s, theme: next }))}
      className="grid size-10 cursor-pointer place-items-center rounded-xl text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      title={t.nav.theme[settings.theme]}
      aria-label={t.nav.theme[settings.theme]}
    >
      <Icon className="size-[18px]" />
    </button>
  )
}

export function Layout({ children, route, compact }: { children: ReactNode; route: string; compact?: boolean }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip">
      <Backdrop />
      {!compact && (
        <header className="sticky top-0 z-30 border-b border-transparent backdrop-blur-xl [mask-image:linear-gradient(black_85%,transparent)]">
          <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
            <a href="#/" className="rounded-xl" aria-label={t.nav.home}>
              <Logo />
            </a>
            <div className="flex items-center gap-1">
              <a
                href="#/settings"
                className={cx(
                  'flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition',
                  route === '/settings'
                    ? 'bg-slate-900/5 text-slate-900 dark:bg-white/10 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
                )}
              >
                <Settings2 className="size-[18px]" aria-hidden />
                <span className="hidden sm:inline">{t.nav.settings}</span>
              </a>
              {REPO_URL && (
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label={t.nav.source}
                  title={t.nav.source}
                >
                  <GithubMark />
                </a>
              )}
              <ThemeButton />
            </div>
          </nav>
        </header>
      )}
      <main className="flex-1">{children}</main>
      {!compact && (
        <footer className="mx-auto w-full max-w-5xl px-4 py-8 text-xs text-slate-500 sm:px-6 dark:text-slate-500">
          <div className="flex flex-col gap-1 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between dark:border-white/10">
            <span>
              {t.app.name} · {t.footer.license}
            </span>
            <span>{t.footer.notTeacher}</span>
          </div>
        </footer>
      )}
    </div>
  )
}

/** Soft colour glows behind the content. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 animate-float rounded-full bg-violet-500/15 blur-[120px] dark:bg-violet-600/20" />
      <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] animate-float rounded-full bg-cyan-400/15 blur-[120px] [animation-delay:-3s] dark:bg-cyan-500/10" />
      <div className="absolute -bottom-40 -left-32 h-[380px] w-[480px] animate-float rounded-full bg-fuchsia-400/10 blur-[120px] [animation-delay:-6s] dark:bg-fuchsia-500/10" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(100,116,139,0.12)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] dark:bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)]" />
    </div>
  )
}

function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-[18px]" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}
