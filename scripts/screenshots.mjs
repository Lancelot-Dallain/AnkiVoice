#!/usr/bin/env node
/**
 * Regenerates the README screenshots in docs/screenshots/.
 *
 *   npm run dev                       (terminal 1)
 *   PORT=8766 npm run mock:anki       (terminal 2)
 *   npm run screenshots               (terminal 3)
 *
 * Uses the Edge or Chrome already installed (playwright-core downloads no
 * browser). Sound is muted and the microphone is simulated, so the script is
 * silent and needs no hardware.
 */
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const APP = process.env.APP_URL ?? 'http://localhost:5173/'
const OUT = 'docs/screenshots'
const channel = process.env.BROWSER_CHANNEL ?? 'msedge'

const SETTINGS = {
  theme: 'dark',
  anki: {
    url: 'http://localhost:8766',
    deck: 'Anglais::Vocabulaire',
    mapping: { english: 'Front', french: 'Back', example: 'Example', kind: 'Type' },
  },
  session: { mode: 'en-fr', size: 20, autoSpeak: true, autoListen: false },
}

/** Silent speech synthesis with fake voices, and a scripted "microphone". */
function fakeSpeech(settings) {
  localStorage.setItem('ankivoice.settings.v1', JSON.stringify(settings))
  const voices = [
    { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English', localService: false },
    { name: 'Google français', lang: 'fr-FR', voiceURI: 'Google français', localService: false },
  ]
  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      getVoices: () => voices,
      speak: (u) => setTimeout(() => u.onend?.(), 50),
      cancel() {},
      addEventListener() {},
      removeEventListener() {},
    },
  })
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text
    }
  }
  window.__answers = []
  window.__hold = false
  class FakeRecognition {
    start() {
      const text = window.__answers.shift() ?? ''
      const emit = (final, value) => {
        const alt = { transcript: value, confidence: 0.9 }
        const res = Object.assign([alt], { isFinal: final })
        this.onresult?.({ resultIndex: 0, results: [res] })
      }
      setTimeout(() => emit(false, text.slice(0, Math.ceil(text.length * 0.6))), 300)
      const finish = () => {
        if (window.__hold) return setTimeout(finish, 100)
        emit(true, text)
        this.onend?.()
      }
      setTimeout(finish, 700)
    }
    stop() {}
    abort() {
      this.onend?.()
    }
  }
  window.SpeechRecognition = FakeRecognition
}

const browser = await chromium.launch({ channel, headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.5, colorScheme: 'dark' })
await context.addInitScript(fakeSpeech, SETTINGS)
const page = await context.newPage()
await mkdir(OUT, { recursive: true })
const shot = async (name) => {
  await page.waitForTimeout(900) // let animations settle
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`✓ ${OUT}/${name}.png`)
}
const say = (text, hold = false) => page.evaluate(([t, h]) => (window.__answers.push(t), (window.__hold = h)), [text, hold])

// Home
await page.goto(APP)
await shot('home')

// Quiz: listening, then the answer
await page.getByRole('button', { name: 'Lancer la démo' }).click()
await say('emprunter', true)
await page.getByRole('button', { name: 'Appuyez pour parler' }).click()
await page.waitForTimeout(600)
await shot('quiz-listening')
await page.evaluate(() => (window.__hold = false))
await page.getByRole('button', { name: 'Continuer' }).waitFor()
await shot('quiz-correct')
await page.keyboard.press('Enter')

// A miss, then the written retry
await say('compter')
await page.getByRole('button', { name: 'Appuyez pour parler' }).click()
await page.getByText('Voici le mot écrit').waitFor()
await shot('quiz-retry')
await say('une compétence')
await page.getByRole('button', { name: 'Appuyez pour parler' }).click()
await page.getByRole('button', { name: 'Continuer' }).click()

// Two more, then the summary
await say('fiable')
await page.getByRole('button', { name: 'Appuyez pour parler' }).click()
await page.getByRole('button', { name: 'Continuer' }).click()
await page.getByRole('button', { name: 'Je ne sais pas' }).click()
await page.getByRole('button', { name: 'Continuer' }).click()
await page.getByRole('button', { name: 'Quitter' }).click()
await page.waitForTimeout(800)
await shot('summary')

// Settings (needs the mock AnkiConnect on port 8766)
await page.goto(`${APP}#/settings`)
await page.getByText('Correspondance des champs').waitFor({ timeout: 5000 }).catch(() => {})
await shot('settings')

// Mobile
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true })
await mobile.addInitScript(fakeSpeech, { ...SETTINGS, session: { ...SETTINGS.session, mode: 'fr-en' } })
const phone = await mobile.newPage()
await phone.goto(APP)
await phone.getByRole('button', { name: 'Lancer la démo' }).click()
await phone.evaluate(() => (window.__answers.push('to borrow'), (window.__hold = true)))
await phone.getByRole('button', { name: 'Appuyez pour parler' }).click()
await phone.waitForTimeout(1200)
await phone.screenshot({ path: `${OUT}/mobile.png` })
console.log(`✓ ${OUT}/mobile.png`)

await browser.close()
