import type { Config } from '@/types/config/config'
import { describe, expect, it } from 'vitest'
import { migrations } from '../../migration'
import { configExample } from '../example/v3'

describe('config Migration 3 -> 4', () => {
  it('should have migration function for version 4', () => {
    expect(migrations[4]).toBeDefined()
    expect(typeof migrations[4]).toBe('function')
  })

  it('should migrate pageTranslate config in version 3', () => {
    const oldConfig = configExample
    const newConfig = migrations[4](oldConfig as unknown as Config) as any

    expect(newConfig.providersConfig).toEqual({
      openai: {
        apiKey: 'sk-1234567890',
      },
      deepseek: {
        apiKey: undefined,
      },
      openrouter: {
        apiKey: undefined,
      },
    })
    expect(newConfig.read).toEqual({
      provider: 'openai',
      models: {
        openai: {
          model: 'gpt-4o-mini',
          isCustomModel: true,
          customModel: 'gpt-4.1-nano',
        },
        deepseek: {
          model: 'deepseek-chat',
          isCustomModel: false,
          customModel: '',
        },
      },
    })
    expect(newConfig.translate).toEqual({
      provider: 'microsoft',
      models: {
        microsoft: null,
        google: null,
        openai: {
          model: 'gpt-4o-mini',
          isCustomModel: true,
          customModel: 'gpt-4.1-nano',
        },
        deepseek: {
          model: 'deepseek-chat',
          isCustomModel: false,
          customModel: '',
        },
        openrouter: {
          model: 'meta-llama/llama-4-maverick:free',
          isCustomModel: false,
          customModel: '',
        },
      },
      node: {
        enabled: true,
        hotkey: 'Control',
      },
      page: {
        range: 'main',
      },
    })
  })

  it('should preserve existing config properties during migration', () => {
    const oldConfig = configExample as unknown as Config
    const newConfig = migrations[4](oldConfig)

    expect(newConfig.floatingButton).toEqual({
      enabled: true,
      position: 0.6,
    })
  })
})
