import type { Config } from '@/types/config/config'

import { describe, expect, it } from 'vitest'

import { LATEST_SCHEMA_VERSION, migrations } from '../migration'
import { ConfigV1Example, ConfigV2Example } from './example-config'

describe('config Migration', () => {
  describe('schema Version', () => {
    it('should have a valid schema version', () => {
      expect(LATEST_SCHEMA_VERSION).toBeDefined()
      expect(typeof LATEST_SCHEMA_VERSION).toBe('number')
    })
  })

  describe('schema Migration Functions', () => {
    describe('1 -> 2', () => {
      it('should have migration function for version 2', () => {
        expect(migrations[2]).toBeDefined()
        expect(typeof migrations[2]).toEqual('function')
      })

      it('should add pageTranslate config in version 2 migration', () => {
        const oldConfig = ConfigV1Example

        const newConfig = migrations[2](oldConfig as unknown as Config) as any

        expect(newConfig.pageTranslate).toBeDefined()
        expect(newConfig.pageTranslate.range).toEqual('mainContent')
      })

      it('should preserve existing config properties during migration', () => {
        // Clone DEFAULT_CONFIG to avoid modifying the original
        const oldConfig = ConfigV1Example as unknown as Config

        const newConfig = migrations[2](oldConfig)

        // Verify original properties are preserved
        expect(newConfig.language.targetCode).toEqual('jpn')
        expect(newConfig.providersConfig.openai.apiKey).toEqual(
          'sk-1234567890',
        )
        expect(newConfig.providersConfig.deepseek.apiKey).toBeUndefined()
      })
    })

    describe('2 -> 3', () => {
      it('should have migration function for version 3', () => {
        expect(migrations[3]).toBeDefined()
        expect(typeof migrations[3]).toBe('function')
      })

      it('should migrate pageTranslate config in version 3', () => {
        const oldConfig = ConfigV2Example
        const newConfig = migrations[3](oldConfig as unknown as Config) as any

        expect(newConfig.translate).toBeDefined()
        expect(newConfig.translate.provider).toEqual('microsoft')
        expect(newConfig.translate.node).toEqual(oldConfig.manualTranslate)
        expect(newConfig.translate.page).toEqual({ range: 'main' })
      })

      it('should preserve existing config properties during migration', () => {
        // Clone DEFAULT_CONFIG to avoid modifying the original
        const oldConfig = ConfigV1Example as unknown as Config

        const newConfig = migrations[2](oldConfig)

        // Verify original properties are preserved
        expect(newConfig.language.targetCode).toEqual('jpn')
        expect(newConfig.providersConfig.openai.apiKey).toEqual(
          'sk-1234567890',
        )
        expect(newConfig.providersConfig.deepseek.apiKey).toBeUndefined()
      })
    })
  })
})
