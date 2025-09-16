import { describe, expect, it } from 'vitest'
import { DEFAULT_DEEPLX_CONFIG } from '@/utils/constants/providers'
import { deeplxTranslate, googleTranslate, microsoftTranslate } from '../../api'

describe('googleTranslate', () => {
  it('should translate text', async () => {
    const result = await googleTranslate('Library', 'en', 'zh')
    expect(result).toBe('图书馆')
  })
  it('should translate text to traditional chinese', async () => {
    const result = await googleTranslate('Library', 'en', 'zh-TW')
    expect(result).toBe('圖書館')
  })
})

describe('microsoftTranslate', () => {
  it('should translate text', async () => {
    const result = await microsoftTranslate('Library', 'en', 'zh')
    expect(result).toBe('图书馆')
  })
  it('should translate text to traditional chinese', async () => {
    const result = await microsoftTranslate('Library', 'en', 'zh-TW')
    expect(result).toBe('圖書館')
  })
})

describe('deeplxTranslate', () => {
  it('should translate text', async () => {
    const result = await deeplxTranslate('Library', 'en', 'zh', DEFAULT_DEEPLX_CONFIG)
    expect(result).toBe('图书馆')
  })
  it('should translate text to traditional chinese', async () => {
    const result = await deeplxTranslate('Library', 'en', 'zh-TW', DEFAULT_DEEPLX_CONFIG)
    expect(result).toBe('圖書館')
  })
})
