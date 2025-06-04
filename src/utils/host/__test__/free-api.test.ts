import { googleTranslate, microsoftTranslate } from '../translate/api'

describe('googleTranslate', () => {
  it('should translate text', async () => {
    const result = await googleTranslate('Hello', 'en', 'zh')
    expect(result).toBe('你好')
  })
})

describe('microsoftTranslate', () => {
  it('should translate text', async () => {
    const result = await microsoftTranslate('Hello', 'en', 'zh')
    expect(result).toBe('你好')
  })
})
