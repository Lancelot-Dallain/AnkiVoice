import { useEffect, useState } from 'react'
import { Layout } from './components/Layout'
import { assignDirections } from './lib/session'
import { Home } from './screens/Home'
import { type ActiveSession, Quiz } from './screens/Quiz'
import { Settings } from './screens/Settings'
import { SettingsProvider, useHashRoute, useSettings } from './state'

function Router() {
  const [route, navigate] = useHashRoute()
  const [settings] = useSettings()
  const [session, setSession] = useState<ActiveSession | null>(null)

  // A reload on #/session has no cards to show: go home.
  useEffect(() => {
    if (route === '/session' && !session) navigate('/')
  }, [route, session, navigate])

  const start = (next: Omit<ActiveSession, 'key'>) => {
    setSession({ ...next, key: Date.now() })
    navigate('/session')
  }

  if (route === '/session' && session) {
    return (
      <Layout route={route} compact>
        <Quiz
          key={session.key}
          session={session}
          onExit={() => navigate('/')}
          onRestart={() =>
            session.source === 'demo'
              ? start({ ...session, directions: assignDirections(session.cards.length, settings.session.mode) })
              : navigate('/')
          }
        />
      </Layout>
    )
  }

  return (
    <Layout route={route}>
      {route === '/settings' ? <Settings /> : <Home onStart={start} navigate={navigate} />}
    </Layout>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <Router />
    </SettingsProvider>
  )
}
