<div align="center">

<img src="public/favicon.svg" width="72" alt="" />

# AnkiVoice

**Speak your Anki deck.** A free, open-source voice quiz that reads your own Anki cards aloud,
listens to your answer and sends the grade back to Anki.

[Try the demo](#try-it) · [Install AnkiConnect](#connect-your-anki-step-by-step) · [Privacy](#privacy) · [Limits](#honest-limits) · [Roadmap](#roadmap) · [🇫🇷 Lire en français](README.fr.md)

![AnkiVoice listening to an answer](docs/screenshots/quiz-listening.png)

</div>

## Why

Many French secondary schools are short of English teachers, and students rarely get to *say* the words they revise.
AnkiVoice turns the flashcards a learner already keeps in [Anki](https://apps.ankiweb.net) into a short spoken drill:

1. **Listen** — the app pronounces the English word (the word stays hidden).
2. **Answer out loud** in French (or type it). Missed it? The word appears in writing and you try again.
3. **Progress** — the grade goes straight into Anki, which keeps doing the spaced repetition.

It also works the other way round: the French word is shown, you say it in English, and you see what the speech recognition heard.

### How is it different from Duolingo Max, Speak or Praktika?

|                     | AnkiVoice                                    | Typical voice-tutor apps            |
| ------------------- | -------------------------------------------- | ----------------------------------- |
| Price               | Free, open source (MIT)                      | Subscription                        |
| Vocabulary          | **Your own** Anki cards, your school's lists | The app's curriculum                |
| Scheduling          | Anki's spaced repetition, untouched          | Proprietary                         |
| Account / tracking  | None, no analytics                           | Account required                    |
| AI                  | Optional: your key, or a free local model    | Built in, paid                      |

AnkiVoice is a practice tool. **It does not replace a teacher.**

## Screenshots

| Home | Right answer | Second try (word shown) |
| --- | --- | --- |
| ![Home](docs/screenshots/home.png) | ![Correct answer](docs/screenshots/quiz-correct.png) | ![Retry](docs/screenshots/quiz-retry.png) |

| Session summary | Settings | Phone |
| --- | --- | --- |
| ![Summary](docs/screenshots/summary.png) | ![Settings](docs/screenshots/settings.png) | ![Mobile](docs/screenshots/mobile.png) |

## Try it

The **demo mode** needs nothing installed: open the site and click *Lancer la démo*. It uses 12 built-in English cards
(written for this project, MIT-licensed) and never talks to Anki.

Best experienced in **Chrome or Edge** on a computer (they have speech recognition and good English voices).

## Connect your Anki, step by step

AnkiVoice reads your cards through the free **AnkiConnect** add-on. Anki must be open on the same computer.

1. **Install Anki** (free) from <https://apps.ankiweb.net> and open it.
2. **Install AnkiConnect**: in Anki, *Tools → Add-ons → Get Add-ons…*, paste the code **`2055492159`**, click OK, then **restart Anki**.
3. **Allow the AnkiVoice page.** The easiest way: in AnkiVoice click *Se connecter à Anki* — Anki shows a pop-up asking whether
   to allow the site; answer **Yes** and AnkiConnect remembers it. To do it by hand instead:
   *Tools → Add-ons →* select *AnkiConnect* *→ Config*, and add the page's address (shown in AnkiVoice's settings) to `webCorsOriginList`:

   ```json
   "webCorsOriginList": [
       "http://localhost",
       "https://YOUR-GITHUB-NAME.github.io"
   ]
   ```

   Click OK and restart Anki. When running AnkiVoice on your own computer, the address is `http://localhost:5173`.
4. In AnkiVoice, open **Réglages → Se connecter à Anki**. Chrome may ask to *allow access to devices on your local network*: accept, it is how the page reaches Anki on your computer.
5. **Choose your deck** and tell AnkiVoice which field holds the English, the French, an optional example sentence and an optional type
   (*vocabulaire / grammaire / conjugaison*). AnkiVoice guesses common names such as `Front`/`Back` and shows a preview.
6. Back on the home page, click **Commencer**. Only cards that are **due** are used (plus, if you want, a few new ones).

### How grades are sent to Anki

| What happened                                                       | Grade sent      |
| ------------------------------------------------------------------- | --------------- |
| Understood by ear (EN→FR) / found without a hint (FR→EN)            | **Good (3)**    |
| Found only once the word was written (EN→FR) / with the hint (FR→EN) | **Hard (2)**    |
| Missed twice or "I don't know"                                      | **Again (1)**   |

You can change the grade (including **Easy (4)**) before moving on. The grade is sent with AnkiConnect's `answerCards`,
exactly as if you had pressed the button in Anki: **AnkiVoice never reimplements the scheduling.**

## The AI judge (optional)

Without AI, AnkiVoice compares your answer with the card, ignoring articles, accents, case and one small typo, and accepting every
alternative written on the card (`emprunter, se faire prêter`). With an AI, it also accepts synonyms and agreement differences,
and explains mistakes in one short sentence. Exact matches never call the AI, so it stays cheap.

| Provider | Cost | Setup |
| --- | --- | --- |
| **None** | Free | Nothing to do |
| **Ollama** (local) | Free | Install [Ollama](https://ollama.com), run `ollama pull llama3.2`. For the online version, allow the site: `OLLAMA_ORIGINS=https://YOUR-GITHUB-NAME.github.io ollama serve` |
| **Claude** (Anthropic) | Your API key | Paste a key from <https://console.anthropic.com>. Judge model: `claude-haiku-5-5` (cheap and fast). |
| **OpenAI-compatible** | Your API key | Base URL + model + key (OpenAI, Mistral, Groq, OpenRouter, LM Studio…) |

Students never need to pay: "None" and Ollama are free.

## Privacy

- No account, no server, no analytics, no cookies. AnkiVoice is a static website.
- Settings (including any API key) are stored **only in your browser** (`localStorage`).
- Your cards go to **your own Anki** (on your computer) and, if you choose one, to **the AI provider you picked** — nowhere else.
- Fonts are bundled with the app (no Google Fonts call).
- ⚠️ **Speech recognition is done by your browser**: in Chrome and Edge the audio is sent to Google's / Microsoft's servers to be transcribed. If that is a problem, answer with the keyboard.

## Honest limits

- **It does not grade your pronunciation.** Browser speech recognition picks the most *plausible word*: a slightly wrong
  pronunciation is often "corrected" silently. Real phonetic feedback is planned for v0.3.
- **Speech recognition** only works in Chrome, Edge and Safari. Firefox users answer with the keyboard.
- **Voices**: English is always read with an English voice. If your computer has no English voice installed (common on French
  Windows), AnkiVoice shows the word in writing instead of reading it with a French accent. To add one on Windows:
  *Settings → Time & language → Speech → Add voices → English (United States)*, then restart the browser — or simply use Chrome or Edge,
  which ship their own English voices. Choose your favourite voice in *Réglages → Voix*.
- **The online version reaching Anki** relies on the browser allowing an HTTPS page to call `http://localhost`. Chrome and Edge do
  (after the "local network" prompt); Safari may block it — use Chrome/Edge or run AnkiVoice locally.
- **New cards** added by AnkiVoice don't follow Anki's "new cards per day" limit; a per-session cap is in the settings.
- The AI can be wrong. You always have the last word on the grade.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20.19 or newer.

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. Other commands:

```bash
npm test            # unit tests (Vitest)
npm run build       # production build in dist/
npm run mock:anki   # a fake AnkiConnect on port 8765, to develop without Anki (don't run it while Anki is open)
npm run screenshots # regenerate the README screenshots (needs the dev server and `PORT=8766 npm run mock:anki`)
```

### Publish on GitHub Pages

The workflow in `.github/workflows/ci.yml` runs the tests, builds and deploys on every push to `main`.
In the repository on GitHub: *Settings → Pages → Build and deployment → Source: **GitHub Actions***.

## Roadmap

- **v0.1** (this release): spoken quiz on due cards, both directions, grades sent to Anki, AI judge (Claude / OpenAI-compatible / Ollama / none), demo mode.
- **v0.2**: an end-of-session conversation with the AI that reuses the words you missed and the grammar rules of your cards.
- **v0.3**: real pronunciation feedback (e.g. Azure Pronunciation Assessment); a free starter deck built only from openly licensed
  sources (frequency lists, Wiktionary — licence cited); English interface.

## How it is built

React + TypeScript + Vite + Tailwind CSS, no backend. The interesting parts are small and tested:

| File | What it does |
| --- | --- |
| `src/lib/anki/client.ts` | AnkiConnect client (`requestPermission`, `findCards`, `cardsInfo`, `answerCards`) with clear error types |
| `src/lib/grading.ts` | The outcome → Anki grade rule and the session summary |
| `src/lib/session.ts` | The quiz as a pure state machine |
| `src/lib/judge.ts`, `src/lib/text.ts` | Offline answer matching and the AI judge prompt |
| `src/lib/llm/` | One interface, three adapters: Anthropic SDK (browser), OpenAI-compatible, Ollama |
| `src/lib/voices.ts`, `src/lib/speech.ts` | Voice choice (never the wrong language) and Web Speech API wrappers |
| `src/i18n/fr.ts` | Every UI string, ready for translation |

Contributions are welcome — especially translations, accessibility and free word lists. Please never contribute content copied from textbooks.

## Licence

[MIT](LICENSE) © 2026 Lancelot Dallain. The demo cards are part of the project and under the same licence.
