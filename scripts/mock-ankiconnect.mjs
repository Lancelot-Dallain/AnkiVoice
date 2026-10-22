#!/usr/bin/env node
/**
 * A fake AnkiConnect for development and demos: `npm run mock:anki`.
 * Listens on http://localhost:8765 like the real add-on, serves one small deck
 * and prints every grade it receives. Never run it while Anki is open (same port).
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT ?? 8765)

const notes = [
  ['to borrow', 'emprunter', 'Can I borrow your pen?', 'Vocabulaire'],
  ['a skill', 'une compétence', 'Teamwork is a useful skill.', 'Vocabulaire'],
  ['to improve', 'améliorer', 'I want to improve my accent.', 'Vocabulaire'],
  ['she has eaten', 'elle a mangé', 'She has already eaten.', 'Conjugaison'],
  ['although', 'bien que, même si', 'Although it was late, we stayed.', 'Grammaire'],
]

const cards = notes.map(([front, back, example, type], i) => ({
  cardId: 1000 + i,
  note: 2000 + i,
  deckName: 'Anglais::Vocabulaire',
  modelName: 'AnkiVoice (mock)',
  type: 2,
  fields: {
    Front: { value: front, order: 0 },
    Back: { value: back, order: 1 },
    Example: { value: `<i>${example}</i>`, order: 2 },
    Type: { value: type, order: 3 },
  },
}))

const actions = {
  requestPermission: () => ({ permission: 'granted', requireApikey: false, version: 6 }),
  version: () => 6,
  deckNames: () => ['Default', 'Anglais', 'Anglais::Vocabulaire'],
  findCards: ({ query }) => (/is:new/.test(query) ? [] : cards.map((c) => c.cardId)),
  cardsInfo: ({ cards: ids }) => cards.filter((c) => ids.includes(c.cardId)),
  answerCards: ({ answers }) => {
    for (const { cardId, ease } of answers) console.log(`answerCards  card ${cardId} → ease ${ease}`)
    return answers.map(({ cardId }) => cards.some((c) => c.cardId === cardId))
  },
}

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') return res.end()
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    let reply
    try {
      const { action, params = {} } = JSON.parse(body || '{}')
      const handler = actions[action]
      reply = handler ? { result: handler(params), error: null } : { result: null, error: 'unsupported action' }
    } catch (error) {
      reply = { result: null, error: String(error) }
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(reply))
  })
}).listen(PORT, () => console.log(`Mock AnkiConnect listening on http://localhost:${PORT}`))
