import { describe, expect, it } from 'vitest'
import { cleanField, frenchSoundKey, hintFor, levenshtein, localMatch, maskInExample, normalize, splitAlternatives } from './text'

describe('cleanField', () => {
  it('strips HTML, sound tags and entities from Anki fields', () => {
    expect(cleanField('<div>to&nbsp;borrow</div>[sound:borrow.mp3]')).toBe('to borrow')
    expect(cleanField('l&#39;école<br>la classe')).toBe("l'école\nla classe")
    expect(cleanField('<b>Tom &amp; Jerry</b>')).toBe('Tom & Jerry')
    expect(cleanField(undefined)).toBe('')
  })
})

describe('normalize', () => {
  it('drops case, accents, punctuation and leading articles', () => {
    expect(normalize('  Une Compétence ! ', 'fr')).toBe('competence')
    expect(normalize("L'école", 'fr')).toBe('ecole')
    expect(normalize('To borrow', 'en')).toBe('borrow')
    expect(normalize('The meeting.', 'en')).toBe('meeting')
    expect(normalize('avoir hâte de', 'fr')).toBe('avoir hate de')
  })
})

describe('splitAlternatives', () => {
  it('splits on commas, slashes, semicolons and "ou", ignoring parentheses', () => {
    expect(splitAlternatives('atteindre, réaliser (un but) / accomplir')).toEqual(['atteindre', 'réaliser', 'accomplir'])
    expect(splitAlternatives('bien que ou même si')).toEqual(['bien que', 'même si'])
  })
})

describe('levenshtein', () => {
  it('counts edits', () => {
    expect(levenshtein('fiable', 'fiable')).toBe(0)
    expect(levenshtein('fiable', 'fiabl')).toBe(1)
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })
})

describe('localMatch', () => {
  it('accepts any listed alternative, with or without article', () => {
    expect(localMatch(['un savoir-faire'], 'une compétence, un savoir-faire', 'fr').correct).toBe(true)
    expect(localMatch(['compétence'], 'une compétence', 'fr')).toMatchObject({ correct: true, close: false })
  })

  it('checks every speech recognition alternative', () => {
    expect(localMatch(['fiable ?', 'viable'], 'fiable', 'fr').correct).toBe(true)
    expect(localMatch(['viable', 'fiable'], 'fiable', 'fr').correct).toBe(true)
  })

  it('tolerates a typo and flags it as close', () => {
    expect(localMatch(['ameliorer'], 'améliorer', 'fr')).toMatchObject({ correct: true, close: false })
    expect(localMatch(['amélioré'], 'améliorer', 'fr')).toMatchObject({ correct: true, close: true })
  })

  it('accepts filler words around the answer', () => {
    expect(localMatch(['euh emprunter'], 'emprunter', 'fr').correct).toBe(true)
  })

  it('rejects wrong answers', () => {
    expect(localMatch(['prêter'], 'emprunter', 'fr').correct).toBe(false)
    expect(localMatch([''], 'emprunter', 'fr').correct).toBe(false)
    // Short words get no typo tolerance.
    expect(localMatch(['cat'], 'car', 'en').correct).toBe(false)
  })
})

describe('French homophones (speech recognition picks a spelling at random)', () => {
  const key = (s: string) => frenchSoundKey(normalize(s, 'fr'))

  it('gives the same key to words that sound the same', () => {
    expect(key('améliorait')).toBe(key('améliorer'))
    expect(key('améliorez')).toBe(key('améliorer'))
    expect(key('compétences')).toBe(key('compétence'))
    expect(key('en prunter')).toBe(key('emprunter'))
    expect(key('des inconvénients')).toBe(key('un inconvénient'))
    expect(key('fotographie')).toBe(key('photographie'))
  })

  it('keeps different words apart', () => {
    expect(key('prêter')).not.toBe(key('emprunter'))
    expect(key('avantage')).not.toBe(key('inconvénient'))
    expect(key('fiable')).not.toBe(key('faible'))
  })

  it('accepts a homophone and flags it', () => {
    expect(localMatch(['améliorait'], 'améliorer, progresser', 'fr')).toMatchObject({ correct: true, homophone: true })
    expect(localMatch(['en prunter'], 'emprunter', 'fr')).toMatchObject({ correct: true, homophone: true })
    expect(localMatch(['un avantage'], 'un inconvénient', 'fr').correct).toBe(false)
  })
})

describe('hints', () => {
  it('gives the first letter and length', () => {
    expect(hintFor('to borrow')).toEqual({ first: 'B', letters: 6 })
  })

  it('masks the word and its inflections in the example', () => {
    expect(maskInExample('She achieved her goal.', 'to achieve')).toBe('She ___ her goal.')
    expect(maskInExample('Can I borrow your pen?', 'to borrow')).toBe('Can I ___ your pen?')
  })
})
