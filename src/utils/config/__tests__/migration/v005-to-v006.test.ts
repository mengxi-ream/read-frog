import type { Config } from '@/types/config/config'
import { describe, expect, it } from 'vitest'
import { migrations } from '../../migration'
import { configExample } from '../example/v005'

describe('config Migration 5 -> 6', () => {
  it('should have migration function for version 6', () => {
    expect(migrations[6]).toBeDefined()
    expect(typeof migrations[6]).toBe('function')
  })

  it('should add Ollama provider configuration in version 6 migration', () => {
    const oldConfig = configExample
    const newConfig = migrations[6](oldConfig as unknown as Config) as any

    // 验证 Ollama 提供商配置已添加
    expect(newConfig.providersConfig.ollama).toEqual({
      apiKey: undefined,
      baseURL: 'http://127.0.0.1:11434/v1',
    })

    // 验证 Ollama 翻译模型配置已添加
    expect(newConfig.translate.models.ollama).toEqual({
      model: 'gemma3:1b',
      isCustomModel: false,
      customModel: '',
    })
  })

  it('should preserve existing config properties during migration', () => {
    const oldConfig = configExample as unknown as Config
    const newConfig = migrations[6](oldConfig)

    // 验证原有属性被保留
    expect(newConfig.language.targetCode).toEqual('jpn')
    expect(newConfig.providersConfig.openai.apiKey).toEqual('sk-1234567890')
    expect(newConfig.providersConfig.deepseek.apiKey).toBeUndefined()
    expect(newConfig.read.provider).toEqual('openai')
    expect(newConfig.translate.provider).toEqual('microsoft')

    // 验证原有提供商配置被保留
    expect(newConfig.providersConfig.openai.baseURL).toBe('https://api.openai.com/v1')
    expect(newConfig.providersConfig.deepseek.baseURL).toBe('https://api.deepseek.com/v1')
    expect(newConfig.providersConfig.openrouter.baseURL).toBe('https://openrouter.ai/api/v1')

    // 验证原有翻译模型配置被保留
    expect(newConfig.translate.models.openai.model).toBe('gpt-4o-mini')
    expect(newConfig.translate.models.deepseek.model).toBe('deepseek-chat')
    expect(newConfig.translate.models.openrouter.model).toBe('meta-llama/llama-4-maverick:free')
  })
})
