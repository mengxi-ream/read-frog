import type { Config } from '@/types/config/config'
import { describe, expect, it } from 'vitest'
import { migrations } from '../../migration'
import { configExample } from '../example/v001'

describe('config Migration 1 -> 2', () => {
  it('should have migration function for version 2', () => {
    expect(migrations[2]).toBeDefined()
    expect(typeof migrations[2]).toEqual('function')
  })

  it('should add pageTranslate config in version 2 migration', () => {
    const oldConfig = configExample
    const newConfig = migrations[2](oldConfig as unknown as Config) as any

    expect(newConfig.pageTranslate).toBeDefined()
    expect(newConfig.pageTranslate.range).toEqual('mainContent')
  })

  it('should preserve existing config properties during migration', () => {
    const oldConfig = configExample as unknown as Config
    const newConfig = migrations[2](oldConfig)

    // Verify original properties are preserved
    expect(newConfig.language.targetCode).toEqual('jpn')
    expect(newConfig.providersConfig.openai.apiKey).toEqual('sk-1234567890')
    expect(newConfig.providersConfig.deepseek.apiKey).toBeUndefined()
  })
})
