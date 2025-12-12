import { describe, expect, it } from 'vitest'
import { CONFIG_SCHEMA_VERSION } from '@/utils/constants/config'
import { ConfigVersionTooNewError } from '../errors'
import { migrateConfig } from '../migration'

describe('migrateConfig', () => {
  it('should throw ConfigVersionTooNewError when schema version is newer than current', async () => {
    const futureVersion = CONFIG_SCHEMA_VERSION + 1
    const config = {}

    await expect(migrateConfig(config, futureVersion))
      .rejects
      .toThrow(ConfigVersionTooNewError)
  })
})
