import type { Config } from '@/types/config/config'
import { describe, expect, it } from 'vitest'
import { migrations } from '../../migration'
import { configExample } from '../example/v2'

describe('config Migration 2 -> 3', () => {
  it('should have migration function for version 3', () => {
    expect(migrations[3]).toBeDefined()
    expect(typeof migrations[3]).toBe('function')
  })

  it('should migrate pageTranslate config in version 3', () => {
    const oldConfig = configExample
    const newConfig = migrations[3](oldConfig as unknown as Config) as any

    expect(newConfig.translate).toBeDefined()
    expect(newConfig.translate.provider).toEqual('microsoft')
    expect(newConfig.translate.node).toEqual(oldConfig.manualTranslate)
    expect(newConfig.translate.page).toEqual({ range: 'main' })
  })

  it('should preserve existing config properties during migration', () => {
    const oldConfig = configExample as unknown as Config
    const newConfig = migrations[3](oldConfig)

    // Verify original properties are preserved
    expect(newConfig.language.targetCode).toEqual('jpn')
    expect(newConfig.providersConfig.openai.apiKey).toEqual('sk-1234567890')
    expect(newConfig.providersConfig.deepseek.apiKey).toBeUndefined()
  })
})
