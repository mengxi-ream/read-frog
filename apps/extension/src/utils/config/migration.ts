import type { MigrationFunction } from './migration-scripts/types'
import type { Config } from '@/types/config/config'
import { i18n } from '#imports'
import { configSchema } from '@/types/config/config'
import { CONFIG_SCHEMA_VERSION } from '../constants/config'
import { migrate as migrateV001ToV002 } from './migration-scripts/v001-to-v002'
import { migrate as migrateV002ToV003 } from './migration-scripts/v002-to-v003'
import { migrate as migrateV003ToV004 } from './migration-scripts/v003-to-v004'
import { migrate as migrateV004ToV005 } from './migration-scripts/v004-to-v005'
import { migrate as migrateV005ToV006 } from './migration-scripts/v005-to-v006'
import { migrate as migrateV006ToV007 } from './migration-scripts/v006-to-v007'
import { migrate as migrateV007ToV008 } from './migration-scripts/v007-to-v008'
import { migrate as migrateV008ToV009 } from './migration-scripts/v008-to-v009'
import { migrate as migrateV009ToV010 } from './migration-scripts/v009-to-v010'
import { migrate as migrateV010ToV011 } from './migration-scripts/v010-to-v011'
import { migrate as migrateV011ToV012 } from './migration-scripts/v011-to-v012'
import { migrate as migrateV012ToV013 } from './migration-scripts/v012-to-v013'
import { migrate as migrateV013ToV014 } from './migration-scripts/v013-to-v014'
import { migrate as migrateV014ToV015 } from './migration-scripts/v014-to-v015'
import { migrate as migrateV015ToV016 } from './migration-scripts/v015-to-v016'
import { migrate as migrateV016ToV017 } from './migration-scripts/v016-to-v017'
import { migrate as migrateV017ToV018 } from './migration-scripts/v017-to-v018'
import { migrate as migrateV018ToV019 } from './migration-scripts/v018-to-v019'
import { migrate as migrateV019ToV020 } from './migration-scripts/v019-to-v020'
import { migrate as migrateV020ToV021 } from './migration-scripts/v020-to-v021'
import { migrate as migrateV021ToV022 } from './migration-scripts/v021-to-v022'
import { migrate as migrateV022ToV023 } from './migration-scripts/v022-to-v023'
import { migrate as migrateV023ToV024 } from './migration-scripts/v023-to-v024'
import { migrate as migrateV024ToV025 } from './migration-scripts/v024-to-v025'
import { migrate as migrateV025ToV026 } from './migration-scripts/v025-to-v026'
import { migrate as migrateV026ToV027 } from './migration-scripts/v026-to-v027'
import { migrate as migrateV027ToV028 } from './migration-scripts/v027-to-v028'

export const LATEST_SCHEMA_VERSION = CONFIG_SCHEMA_VERSION

// when use `"type": "module"` to change the output format of background script to `esm`
// we can't use dynamic import here, so we have to use static import
// https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics
export const migrationScripts: Record<number, MigrationFunction> = {
  2: migrateV001ToV002,
  3: migrateV002ToV003,
  4: migrateV003ToV004,
  5: migrateV004ToV005,
  6: migrateV005ToV006,
  7: migrateV006ToV007,
  8: migrateV007ToV008,
  9: migrateV008ToV009,
  10: migrateV009ToV010,
  11: migrateV010ToV011,
  12: migrateV011ToV012,
  13: migrateV012ToV013,
  14: migrateV013ToV014,
  15: migrateV014ToV015,
  16: migrateV015ToV016,
  17: migrateV016ToV017,
  18: migrateV017ToV018,
  19: migrateV018ToV019,
  20: migrateV019ToV020,
  21: migrateV020ToV021,
  22: migrateV021ToV022,
  23: migrateV022ToV023,
  24: migrateV023ToV024,
  25: migrateV024ToV025,
  26: migrateV025ToV026,
  27: migrateV026ToV027,
  28: migrateV027ToV028,
}

export async function runMigration(version: number, config: any): Promise<any> {
  const migrationFn = migrationScripts[version]

  if (!migrationFn) {
    throw new Error(`Migration function for version ${version} not found`)
  }

  return migrationFn(config)
}

export async function migrateConfig(originalConfig: Config, originalConfigSchemaVersion: number) {
  if (originalConfigSchemaVersion > CONFIG_SCHEMA_VERSION) {
    throw new Error(i18n.t('options.config.sync.versionTooNew'))
  }

  if (originalConfigSchemaVersion < CONFIG_SCHEMA_VERSION) {
    let currentVersion = originalConfigSchemaVersion
    while (currentVersion < CONFIG_SCHEMA_VERSION) {
      const nextVersion = currentVersion + 1
      originalConfig = await runMigration(nextVersion, originalConfig)
      currentVersion = nextVersion
    }
  }

  const parseResult = configSchema.safeParse(originalConfig)
  if (!parseResult.success) {
    throw new Error(`${i18n.t('options.config.sync.validationError')}: ${parseResult.error.message}`)
  }

  return parseResult.data
}
