import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { ProviderConfig } from '@/types/config/provider'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectLanguageWithLLM } from '@/utils/content/analyze'
import { shouldSkipByLanguage } from '../translate-text'

// Mock detectLanguageWithLLM
vi.mock('@/utils/content/analyze', () => ({
  detectLanguageWithLLM: vi.fn(),
}))

const mockedDetect = vi.mocked(detectLanguageWithLLM)

beforeEach(() => {
  mockedDetect.mockReset()
})

// Mock provider configs - only provider field is needed for shouldSkipByLanguage
const mockLLMProviderConfig = {
  id: 'openai-test',
  name: 'OpenAI Test',
  enabled: true,
  provider: 'openai',
  models: {
    read: { model: 'gpt-4o-mini', isCustomModel: false, customModel: null },
    translate: { model: 'gpt-4o-mini', isCustomModel: false, customModel: null },
  },
} as ProviderConfig

const mockAPIProviderConfig = {
  id: 'google-translate-test',
  name: 'Google Translate Test',
  enabled: true,
  provider: 'google-translate',
} as ProviderConfig

describe('shouldSkipByLanguage', () => {
  describe('with franc detection (LLM disabled)', () => {
    it('should return true when text language is in skipLanguages', async () => {
      // Japanese text: "This is a test in Japanese"
      const japaneseText = 'これは日本語のテストです。日本語で書かれたテキストです。'
      const skipLanguages: LangCodeISO6393[] = ['jpn']

      const result = await shouldSkipByLanguage(
        japaneseText,
        skipLanguages,
        false, // LLM detection disabled
        mockAPIProviderConfig,
      )

      expect(result).toBe(true)
    })

    it('should return false when text language is not in skipLanguages', async () => {
      // English text
      const englishText = 'This is a test written in English. It should not be skipped when only Japanese is in the skip list.'
      const skipLanguages: LangCodeISO6393[] = ['jpn']

      const result = await shouldSkipByLanguage(
        englishText,
        skipLanguages,
        false,
        mockAPIProviderConfig,
      )

      expect(result).toBe(false)
    })

    it('should return false when skipLanguages is empty', async () => {
      const japaneseText = 'これは日本語のテストです。日本語で書かれたテキストです。'
      const skipLanguages: LangCodeISO6393[] = []

      const result = await shouldSkipByLanguage(
        japaneseText,
        skipLanguages,
        false,
        mockAPIProviderConfig,
      )

      expect(result).toBe(false)
    })

    it('should return false when language cannot be detected', async () => {
      // Text that franc cannot reliably detect (numbers/symbols)
      const undetectableText = '12345 67890 !@#$%'
      const skipLanguages: LangCodeISO6393[] = ['jpn', 'eng']

      const result = await shouldSkipByLanguage(
        undetectableText,
        skipLanguages,
        false,
        mockAPIProviderConfig,
      )

      expect(result).toBe(false)
    })
  })

  describe('with LLM detection enabled', () => {
    it('should use LLM detection when enabled and provider supports it', async () => {
      mockedDetect.mockResolvedValueOnce('jpn')

      const text = 'これは日本語のテストです。日本語で書かれたテキストです。'
      const skipLanguages: LangCodeISO6393[] = ['jpn']

      const result = await shouldSkipByLanguage(
        text,
        skipLanguages,
        true,
        mockLLMProviderConfig,
      )

      expect(mockedDetect).toHaveBeenCalledWith(text)
      expect(result).toBe(true)
    })

    it('should fall back to franc when LLM detection fails', async () => {
      mockedDetect.mockRejectedValueOnce(new Error('LLM API error'))

      // Japanese text that franc can detect
      const japaneseText = 'これは日本語のテストです。日本語で書かれたテキストです。'
      const skipLanguages: LangCodeISO6393[] = ['jpn']

      const result = await shouldSkipByLanguage(
        japaneseText,
        skipLanguages,
        true,
        mockLLMProviderConfig,
      )

      expect(mockedDetect).toHaveBeenCalled()
      expect(result).toBe(true) // Should still detect Japanese via franc fallback
    })

    it('should fall back to franc when LLM returns undefined', async () => {
      mockedDetect.mockResolvedValueOnce('und')

      const japaneseText = 'これは日本語のテストです。日本語で書かれたテキストです。'
      const skipLanguages: LangCodeISO6393[] = ['jpn']

      const result = await shouldSkipByLanguage(
        japaneseText,
        skipLanguages,
        true,
        mockLLMProviderConfig,
      )

      expect(result).toBe(true) // Should detect Japanese via franc fallback
    })

    it('should not use LLM when provider does not support it', async () => {
      const japaneseText = 'これは日本語のテストです。日本語で書かれたテキストです。'
      const skipLanguages: LangCodeISO6393[] = ['jpn']

      const result = await shouldSkipByLanguage(
        japaneseText,
        skipLanguages,
        true, // LLM enabled, but provider doesn't support it
        mockAPIProviderConfig,
      )

      expect(mockedDetect).not.toHaveBeenCalled()
      expect(result).toBe(true) // Should detect Japanese via franc
    })
  })
})
