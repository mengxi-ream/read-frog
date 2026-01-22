import { describe, expect, it } from 'vitest'
import { getProviderOptions } from '../../providers/options'

describe('getProviderOptions', () => {
  describe('model pattern matching', () => {
    it('should return options for gemini models', () => {
      const options = getProviderOptions('gemini-2.5-pro', 'google')
      expect(options.google).toBeDefined()
      expect(options.google?.thinkingConfig).toMatchObject({ thinkingBudget: 128, includeThoughts: false })
    })

    it('should handle thinking models correctly', () => {
      const thinkingOptions = getProviderOptions('gemini-2.5-pro', 'google')
      expect(thinkingOptions.google?.thinkingConfig).toMatchObject({ thinkingBudget: 128 })

      const nonThinkingOptions = getProviderOptions('gemini-2.5-flash', 'google')
      expect(nonThinkingOptions.google?.thinkingConfig).toMatchObject({ thinkingBudget: 0 })

      const thinkingLevelFlashOptions = getProviderOptions('gemini-3-flash-preview', 'google')
      expect(thinkingLevelFlashOptions.google?.thinkingConfig).toMatchObject({ thinkingLevel: 'low', includeThoughts: false })

      const thinkingLevelProOptions = getProviderOptions('gemini-3-pro-preview', 'google')
      expect(thinkingLevelProOptions.google?.thinkingConfig).toMatchObject({ thinkingLevel: 'low', includeThoughts: false })
    })

    it('should return options for claude models', () => {
      const options = getProviderOptions('claude-3-5-sonnet', 'anthropic')
      expect(options.anthropic).toBeDefined()
      expect(options.anthropic?.thinking).toEqual({ type: 'disabled' })
    })

    it('should return options for OpenAI o1/o3 reasoning models', () => {
      const o1Options = getProviderOptions('o1-preview', 'openai')
      expect(o1Options.openai?.reasoningEffort).toBe('minimal')

      const o3Options = getProviderOptions('o3-mini', 'openai')
      expect(o3Options.openai?.reasoningEffort).toBe('minimal')
    })

    it('should return medium for gpt-5.x-chat-latest and gpt-5.2-pro', () => {
      const gpt52ProOptions = getProviderOptions('gpt-5.2-pro', 'openai')
      expect(gpt52ProOptions.openai?.reasoningEffort).toBe('medium')

      const gpt52ChatLatestOptions = getProviderOptions('gpt-5.2-chat-latest', 'openai')
      expect(gpt52ChatLatestOptions.openai?.reasoningEffort).toBe('medium')

      const gpt51ChatLatestOptions = getProviderOptions('gpt-5.1-chat-latest', 'openai')
      expect(gpt51ChatLatestOptions.openai?.reasoningEffort).toBe('medium')
    })

    it('should return high for gpt-5-pro', () => {
      const gpt5ProOptions = getProviderOptions('gpt-5-pro', 'openai')
      expect(gpt5ProOptions.openai?.reasoningEffort).toBe('high')
    })

    it('should return none for GPT-5.1+ models', () => {
      const gpt51Options = getProviderOptions('gpt-5.1', 'openai')
      expect(gpt51Options.openai?.reasoningEffort).toBe('none')

      const gpt52Options = getProviderOptions('gpt-5.2', 'openai')
      expect(gpt52Options.openai?.reasoningEffort).toBe('none')

      const gpt51CodexOptions = getProviderOptions('gpt-5.1-codex', 'openai')
      expect(gpt51CodexOptions.openai?.reasoningEffort).toBe('none')
    })

    it('should return minimal for GPT-5 models before 5.1 (none not supported)', () => {
      const gpt5Options = getProviderOptions('gpt-5', 'openai')
      expect(gpt5Options.openai?.reasoningEffort).toBe('minimal')

      const gpt5MiniOptions = getProviderOptions('gpt-5-mini', 'openai')
      expect(gpt5MiniOptions.openai?.reasoningEffort).toBe('minimal')

      const gpt5NanoOptions = getProviderOptions('gpt-5-nano', 'openai')
      expect(gpt5NanoOptions.openai?.reasoningEffort).toBe('minimal')
    })

    it('should return empty object for non-matching models', () => {
      const options = getProviderOptions('some-random-model', 'openai')
      expect(options).toEqual({})
    })
  })

  describe('glm model pattern matching', () => {
    it('should match GLM-* models (case-insensitive)', () => {
      const uppercase = getProviderOptions('GLM-4-Plus', 'openai-compatible')
      expect(uppercase['openai-compatible'].thinking).toEqual({ type: 'disabled' })

      const lowercase = getProviderOptions('glm-4-flash', 'openai-compatible')
      expect(lowercase['openai-compatible'].thinking).toEqual({ type: 'disabled' })

      const mixed = getProviderOptions('GlM-3-Turbo', 'tensdaq')
      expect(mixed.tensdaq?.thinking).toEqual({ type: 'disabled' })
    })

    it('should only match models starting with GLM-', () => {
      const middle = getProviderOptions('my-glm-model', 'openai-compatible')
      expect(middle.openaiCompatible).toBeUndefined()

      const end = getProviderOptions('model-GLM', 'openai-compatible')
      expect(end.openaiCompatible).toBeUndefined()
    })
  })
})
