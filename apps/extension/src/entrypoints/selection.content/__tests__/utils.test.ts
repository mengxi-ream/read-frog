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
})
