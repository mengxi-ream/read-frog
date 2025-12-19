import { describe, expect, it } from 'vitest'
import { getProviderOptions } from '../model'

describe('getProviderOptions', () => {
  describe('standard providers', () => {
    it('should return all standard provider options', () => {
      const options = getProviderOptions('gpt-4o-mini')

      expect(options.google).toBeDefined()
      expect(options.anthropic).toBeDefined()
      expect(options.openai).toBeDefined()
    })

    it('should handle thinking models correctly', () => {
      const thinkingOptions = getProviderOptions('gemini-2.5-pro')
      expect(thinkingOptions.google.thinkingConfig).toMatchObject({ thinkingBudget: 128 })

      const nonThinkingOptions = getProviderOptions('gemini-2.5-flash')
      expect(nonThinkingOptions.google.thinkingConfig).toMatchObject({ thinkingBudget: 0 })
    })
  })

  describe('glm model pattern matching', () => {
    it('should match GLM-* models (case-insensitive)', () => {
      const uppercase = getProviderOptions('GLM-4-Plus', 'openaiCompatible')
      expect(uppercase.openaiCompatible?.thinking).toEqual({ type: 'disabled' })

      const lowercase = getProviderOptions('glm-4-flash', 'openaiCompatible')
      expect(lowercase.openaiCompatible?.thinking).toEqual({ type: 'disabled' })

      const mixed = getProviderOptions('GlM-3-Turbo', 'tensdaq')
      expect(mixed.tensdaq?.thinking).toEqual({ type: 'disabled' })
    })

    it('should only match models starting with GLM-', () => {
      const middle = getProviderOptions('my-glm-model', 'openaiCompatible')
      expect(middle.openaiCompatible).toBeUndefined()

      const end = getProviderOptions('model-GLM', 'openaiCompatible')
      expect(end.openaiCompatible).toBeUndefined()
    })

    it('should not add custom options without providerName', () => {
      const options = getProviderOptions('GLM-4-Plus')
      expect(options.openaiCompatible).toBeUndefined()
    })
  })
})
