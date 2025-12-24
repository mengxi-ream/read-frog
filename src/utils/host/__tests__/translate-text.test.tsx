import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { executeTranslate } from '@/utils/host/translate/execute-translate'
import { translateText } from '@/utils/host/translate/translate-text'

// Mock dependencies
vi.mock('@/utils/config/storage', () => ({
  getLocalConfig: vi.fn(),
}))

vi.mock('@/utils/message', () => ({
  sendMessage: vi.fn(),
}))

vi.mock('@/utils/host/translate/api/microsoft', () => ({
  microsoftTranslate: vi.fn(),
}))

vi.mock('@/utils/prompts/translate', () => ({
  getTranslatePrompt: vi.fn(),
}))

let mockSendMessage: any
let mockMicrosoftTranslate: any
let mockGetConfigFromStorage: any
let mockGetTranslatePrompt: any

describe('translate-text', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockSendMessage = vi.mocked((await import('@/utils/message')).sendMessage)
    mockMicrosoftTranslate = vi.mocked((await import('@/utils/host/translate/api/microsoft')).microsoftTranslate)
    mockGetConfigFromStorage = vi.mocked((await import('@/utils/config/storage')).getLocalConfig)
    mockGetTranslatePrompt = vi.mocked((await import('@/utils/prompts/translate')).getTranslatePrompt)

    // Mock getConfigFromStorage to return DEFAULT_CONFIG
    mockGetConfigFromStorage.mockResolvedValue(DEFAULT_CONFIG)

    // Mock getTranslatePrompt to return a simple prompt
    mockGetTranslatePrompt.mockResolvedValue('Translate to {{targetLang}}: {{input}}')
  })

  describe('translateText', () => {
    it('should send message with correct parameters', async () => {
      mockSendMessage.mockResolvedValue('translated text')

      const result = await translateText('test text')

      expect(result).toBe('translated text')
      expect(mockSendMessage).toHaveBeenCalledWith('enqueueTranslateRequest', expect.objectContaining({
        text: 'test text',
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: expect.any(Object),
        scheduleAt: expect.any(Number),
        hash: expect.any(String),
      }))
    })
  })

  describe('executeTranslate', () => {
    const langConfig = {
      sourceCode: 'eng' as const,
      targetCode: 'cmn' as const,
      detectedCode: 'eng' as const,
      level: 'intermediate' as const,
    }

    const providerConfig = {
      id: 'microsoft-default',
      enabled: true,
      name: 'Microsoft Translator',
      provider: 'microsoft-translate' as const,
    }

    it('should return empty string for empty/whitespace input', async () => {
      expect(await executeTranslate('', langConfig, providerConfig)).toBe('')
      expect(await executeTranslate(' ', langConfig, providerConfig)).toBe('')
      expect(await executeTranslate('\n', langConfig, providerConfig)).toBe('')
      expect(await executeTranslate(' \n ', langConfig, providerConfig)).toBe('')
      expect(await executeTranslate(' \n \t', langConfig, providerConfig)).toBe('')
    })

    it('should handle zero-width spaces correctly', async () => {
      // Only zero-width spaces should return empty
      expect(await executeTranslate('\u200B\u200B', langConfig, providerConfig)).toBe('')

      // Mixed invisible + whitespace should return empty
      expect(await executeTranslate('\u200B \u200B', langConfig, providerConfig)).toBe('')

      // Should translate valid content after removing zero-width spaces
      mockMicrosoftTranslate.mockResolvedValue('你好')
      const result = await executeTranslate('\u200B hello \u200B', langConfig, providerConfig)
      expect(result).toBe('你好')
      // Microsoft translate should receive the original text
      expect(mockMicrosoftTranslate).toHaveBeenCalledWith('\u200B hello \u200B', 'en', 'zh')
    })

    it('should trim translation result', async () => {
      mockMicrosoftTranslate.mockResolvedValue('  测试结果  ')

      const result = await executeTranslate('test input', langConfig, providerConfig)

      expect(result).toBe('测试结果')
    })
  })
})
