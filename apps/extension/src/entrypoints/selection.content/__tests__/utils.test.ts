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

  it('should handle selection that equals full text', () => {
    const fullText = ' This is a test sentence. Another sentence here.'
    const selection = ' This is a test sentence. Another sentence here.'

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: '',
      selection: ' This is a test sentence. Another sentence here.',
      after: '',
    })
  })

  describe('edge cases', () => {
    it('should handle empty selection', () => {
      const fullText = 'This is a test sentence.'
      const selection = ''

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: '',
        selection: '',
        after: '',
      })
    })

    it('should handle empty full text', () => {
      const fullText = ''
      const selection = 'test'

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: '',
        selection: 'test',
        after: '',
      })
    })

    it('should handle both empty', () => {
      const fullText = ''
      const selection = ''

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: '',
        selection: '',
        after: '',
      })
    })

    it('should handle selection not found in text', () => {
      const fullText = 'This is a test sentence.'
      const selection = 'notfound'

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: '',
        selection: 'notfound',
        after: '',
      })
    })

    it('should handle selection with leading space when there is text before it', () => {
      const fullText = 'The first sentence. This is a test sentence. Another sentence here.'
      const selection = ' This is a test sentence.'

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: '',
        selection: ' This is a test sentence.',
        after: '',
      })
    })

    it('should handle selection with leading space but without quotes', () => {
      const fullText = 'The first sentence. This is a test sentence. Another sentence here.'
      const selection = ' This is a test sentence'

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: '',
        selection: ' This is a test sentence',
        after: '',
      })
    })

    it('should handle selection that spans multiple sentences', () => {
      const fullText = 'The first sentence. This is a test sentence. Another sentence here.'
      const selection = 'This is a test sentence. Another sentence here.'

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: '',
        selection: 'This is a test sentence. Another sentence here.',
        after: '',
      })
    })
  })
})
