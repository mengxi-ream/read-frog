import { describe, expect, it } from 'vitest'
import { extractTextContext } from '../utils'

describe('extractTextContext', () => {
  it('should extract context when selection is in the middle of a sentence', () => {
    const fullText = 'This is a test sentence. Another sentence here.'
    const selection = 'test'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: 'This is a ',
      selection: 'test',
      after: ' sentence.',
    })
  })

  it('should extract context when selection is at the beginning of a sentence', () => {
    const fullText = 'Hello world! How are you?'
    const selection = 'Hello'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: '',
      selection: 'Hello',
      after: ' world!',
    })
  })

  it('should extract context when selection is at the end of a sentence', () => {
    const fullText = 'Hello world! How are you?'
    const selection = 'you'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: 'How are ',
      selection: 'you',
      after: '?',
    })
  })

  it('should handle Chinese punctuation marks', () => {
    const fullText = '这是一个测试句子。这是另一个句子！'
    const selection = '测试'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: '这是一个',
      selection: '测试',
      after: '句子。',
    })
  })

  it('should handle multiple sentences and find the correct boundary', () => {
    const fullText = 'First sentence. Second sentence with selection. Third sentence.'
    const selection = 'selection'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: 'Second sentence with ',
      selection: 'selection',
      after: '.',
    })
  })

  it('should return empty strings when selection is not found', () => {
    const fullText = 'This is a test sentence.'
    const selection = 'notfound'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: '',
      selection: 'notfound',
      after: '',
    })
  })

  it('should handle selection at the very beginning of text', () => {
    const fullText = 'Hello world!'
    const selection = 'Hello world'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: '',
      selection: 'Hello world',
      after: '!',
    })
  })

  it('should handle selection at the very end of text', () => {
    const fullText = 'Hello world!'
    const selection = 'world'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: 'Hello ',
      selection: 'world',
      after: '!',
    })
  })

  it('should handle empty selection', () => {
    const fullText = 'This is a test sentence.'
    const selection = ''

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: 'This is a test sentence.',
      selection: '',
      after: '',
    })
  })

  it('should handle selection spanning multiple sentences', () => {
    const fullText = 'First sentence. Second sentence. Third sentence.'
    const selection = 'sentence. Second sentence'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: 'First ',
      selection: 'sentence. Second sentence',
      after: '.',
    })
  })

  it('should trim whitespace from the extracted sentence', () => {
    const fullText = '  This is a test sentence.  Another sentence.  '
    const selection = 'test'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: 'This is a ',
      selection: 'test',
      after: ' sentence.',
    })
  })

  it('should handle text with no sentence boundaries', () => {
    const fullText = 'This is a long text without any sentence boundaries'
    const selection = 'long'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: 'This is a ',
      selection: 'long',
      after: ' text without any sentence boundaries',
    })
  })

  it('should handle mixed punctuation types', () => {
    const fullText = 'English sentence! 中文句子？Another sentence.'
    const selection = '中文'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: '',
      selection: '中文',
      after: '句子？',
    })
  })

  it('should handle empty fullText', () => {
    const fullText = ''
    const selection = 'test'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: '',
      selection: 'test',
      after: '',
    })
  })

  it('should handle null/undefined fullText', () => {
    const fullText = null as any
    const selection = 'test'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: '',
      selection: 'test',
      after: '',
    })
  })
})
