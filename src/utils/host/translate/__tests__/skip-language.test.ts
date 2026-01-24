import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { ProviderConfig } from '@/types/config/provider'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectLanguage } from '@/utils/content/language'
import { shouldSkipByLanguage } from '../translate-text'

// Mock detectLanguage
vi.mock('@/utils/content/language', () => ({
  detectLanguage: vi.fn(),
}))

const mockedDetect = vi.mocked(detectLanguage)

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
  describe('basic skip logic', () => {
    it('should return true when detected language is in skipLanguages', async () => {
      mockedDetect.mockResolvedValueOnce('jpn')

      const japaneseText = 'これは日本語のテストです。日本語で書かれたテキストです。'
      const skipLanguages: LangCodeISO6393[] = ['jpn']

      const result = await shouldSkipByLanguage(
        japaneseText,
        skipLanguages,
        false,
        mockAPIProviderConfig,
      )

      expect(result).toBe(true)
    })

    it('should return false when detected language is not in skipLanguages', async () => {
      mockedDetect.mockResolvedValueOnce('eng')

      const englishText = 'This is a test written in English.'
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
      mockedDetect.mockResolvedValueOnce('jpn')

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
      mockedDetect.mockResolvedValueOnce(null)

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

      expect(mockedDetect).toHaveBeenCalledWith(text, {
        minLength: 10,
        enableLLM: true,
        providerConfig: mockLLMProviderConfig,
      })
      expect(result).toBe(true)
    })

    it('should return false when detectLanguage returns null', async () => {
      mockedDetect.mockResolvedValueOnce(null)

      const japaneseText = 'これは日本語のテストです。日本語で書かれたテキストです。'
      const skipLanguages: LangCodeISO6393[] = ['jpn']

      const result = await shouldSkipByLanguage(
        japaneseText,
        skipLanguages,
        true,
        mockLLMProviderConfig,
      )

      expect(mockedDetect).toHaveBeenCalled()
      expect(result).toBe(false) // null detection means no skip
    })

    it('should pass LLM options to detectLanguage', async () => {
      mockedDetect.mockResolvedValueOnce('jpn')

      const japaneseText = 'これは日本語のテストです。日本語で書かれたテキストです。'
      const skipLanguages: LangCodeISO6393[] = ['jpn']

      await shouldSkipByLanguage(
        japaneseText,
        skipLanguages,
        true,
        mockLLMProviderConfig,
      )

      expect(mockedDetect).toHaveBeenCalledWith(japaneseText, {
        minLength: 10,
        enableLLM: true,
        providerConfig: mockLLMProviderConfig,
      })
    })

    it('should disable LLM detection when provider does not support it', async () => {
      mockedDetect.mockResolvedValueOnce('jpn')

      const japaneseText = 'これは日本語のテストです。日本語で書かれたテキストです。'
      const skipLanguages: LangCodeISO6393[] = ['jpn']

      await shouldSkipByLanguage(
        japaneseText,
        skipLanguages,
        true, // LLM enabled, but provider doesn't support it
        mockAPIProviderConfig,
      )

      // Non-LLM providers cannot use LLM detection, so enableLLM is false
      // and providerConfig is undefined (type safety enforced at call site)
      expect(mockedDetect).toHaveBeenCalledWith(japaneseText, {
        minLength: 10,
        enableLLM: false,
        providerConfig: undefined,
      })
    })
  })
})
