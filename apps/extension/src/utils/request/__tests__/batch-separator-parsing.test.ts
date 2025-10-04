import { describe, expect, it } from 'vitest'
import { parseBatchResult } from '@/entrypoints/background/translation-queues'
import { BATCH_SEPARATOR } from '@/utils/constants/prompt'

describe('batch separator parsing edge cases', () => {
  it('should handle standard format', () => {
    const result = `Translation A\n${BATCH_SEPARATOR}\nTranslation B\n${BATCH_SEPARATOR}\nTranslation C`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B', 'Translation C'])
  })

  it('should handle extra spaces after newline before separator', () => {
    const result = `Translation A\n  ${BATCH_SEPARATOR}\nTranslation B`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B'])
  })

  it('should handle extra spaces before newline after separator', () => {
    const result = `Translation A\n${BATCH_SEPARATOR}  \nTranslation B`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B'])
  })

  it('should handle extra spaces on both sides', () => {
    const result = `Translation A\n  ${BATCH_SEPARATOR}  \nTranslation B`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B'])
  })

  it('should handle tabs instead of spaces', () => {
    const result = `Translation A\n\t${BATCH_SEPARATOR}\t\nTranslation B`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B'])
  })

  it('should handle multiple newlines before separator', () => {
    const result = `Translation A\n\n${BATCH_SEPARATOR}\nTranslation B`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B'])
  })

  it('should handle multiple newlines after separator', () => {
    const result = `Translation A\n${BATCH_SEPARATOR}\n\nTranslation B`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B'])
  })

  it('should handle mixed whitespace variations', () => {
    const result = `Translation A\n \t${BATCH_SEPARATOR} \n \tTranslation B\n\n  ${BATCH_SEPARATOR}\t\n\nTranslation C`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B', 'Translation C'])
  })

  it('should handle leading whitespace in content', () => {
    const result = `  Translation A  \n${BATCH_SEPARATOR}\n  Translation B  `
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B'])
  })

  it('should handle single item without separator', () => {
    const result = 'Single translation'
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Single translation'])
  })

  it('should handle single item with leading/trailing whitespace', () => {
    const result = '  \n  Single translation  \n  '
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Single translation'])
  })

  it('should handle empty strings between separators', () => {
    const result = `Translation A\n${BATCH_SEPARATOR}\n\n${BATCH_SEPARATOR}\nTranslation C`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', '', 'Translation C'])
  })

  it('should handle separator without any surrounding newlines', () => {
    const result = `Translation A${BATCH_SEPARATOR}Translation B`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B'])
  })

  it('should handle LLM adding extra formatting', () => {
    // Sometimes LLMs might add markdown-style formatting
    const result = `Translation A\n\n${BATCH_SEPARATOR}\n\nTranslation B\n\n${BATCH_SEPARATOR}\n\nTranslation C`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B', 'Translation C'])
  })

  it('should handle Windows-style line endings (CRLF)', () => {
    const result = `Translation A\r\n${BATCH_SEPARATOR}\r\nTranslation B`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Translation A', 'Translation B'])
  })

  it('should preserve internal newlines within translations', () => {
    const result = `Line 1\nLine 2\n${BATCH_SEPARATOR}\nLine 3\nLine 4`
    const parsed = parseBatchResult(result)
    expect(parsed).toEqual(['Line 1\nLine 2', 'Line 3\nLine 4'])
  })
})
