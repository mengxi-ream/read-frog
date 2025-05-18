import type { Config } from '@/types/config/config'
import { describe, expect, it } from 'vitest'
import { migrations } from '../../migration'
import { configExample } from '../example/v4'

describe('config Migration 4 -> 5', () => {
  it('should have migration function for version 5', () => {
    expect(migrations[5]).toBeDefined()
    expect(typeof migrations[5]).toBe('function')
  })

  it('should add base URL configuration in version 5 migration', () => {
    const oldConfig = configExample
    const newConfig = migrations[5](oldConfig as unknown as Config) as any

    expect(newConfig.providersConfig.openai.baseURL).toBeDefined()
    expect(newConfig.providersConfig.deepseek.baseURL).toBeDefined()
    expect(newConfig.providersConfig.openrouter.baseURL).toBeDefined()
  })

  it('should preserve existing config properties during migration', () => {
    const oldConfig = configExample as unknown as Config
    const newConfig = migrations[5](oldConfig)

    // Verify original properties are preserved
    expect(newConfig.language.targetCode).toEqual('jpn')
    expect(newConfig.providersConfig.openai.apiKey).toEqual('sk-1234567890')
    expect(newConfig.providersConfig.deepseek.apiKey).toBeUndefined()
    expect(newConfig.read.provider).toEqual('openai')
    expect(newConfig.translate.provider).toEqual('microsoft')
  })
})
