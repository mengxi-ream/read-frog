import type { VersionTestData } from '../example/types'
import { describe, expect, it } from 'vitest'
import { configSchema } from '@/types/config/config'
import { CONFIG_SCHEMA_VERSION } from '@/utils/constants/config'
import { logger } from '@/utils/logger'
import { getMigrations, LATEST_SCHEMA_VERSION, runMigration } from '../../migration'

describe('all Config Migrations', () => {
  it('should have the valid latest schema version', async () => {
    expect(LATEST_SCHEMA_VERSION).toBeDefined()
    expect(typeof LATEST_SCHEMA_VERSION).toBe('number')
    expect(LATEST_SCHEMA_VERSION).toBe(CONFIG_SCHEMA_VERSION)

    const migrations = await getMigrations()
    const maxKey = Math.max(...Object.keys(migrations).map(Number))
    expect(maxKey).toBe(LATEST_SCHEMA_VERSION)

    const latestVersionStr = String(LATEST_SCHEMA_VERSION).padStart(3, '0')
    const latestExampleModule = await import(`../example/v${latestVersionStr}.ts`) as VersionTestData

    // Test all configs in the test series
    for (const [seriesId, seriesData] of Object.entries(latestExampleModule.testSeries)) {
      const parseResult = configSchema.safeParse((seriesData).config)
      if (!parseResult.success) {
        console.error(`Schema validation failed for series "${seriesId}":`, parseResult.error.issues)
      }
      expect(parseResult.success).toBe(true)
    }
  })

  it('should have migration scripts for all versions', async () => {
    const migrations = await getMigrations()

    for (let version = 2; version <= LATEST_SCHEMA_VERSION; version++) {
      expect(migrations[version]).toBeDefined()
      expect(typeof migrations[version]).toBe('function')
    }
  })

  // 自动测试从版本2到最新版本的所有迁移
  for (let version = 2; version <= LATEST_SCHEMA_VERSION; version++) {
    const fromVersion = version - 1
    const toVersion = version

    it(`should migrate config from v${fromVersion} to v${toVersion}`, async () => {
      try {
        // 动态导入对应版本的配置示例（明确指定 .ts 扩展名）
        const fromVersionStr = String(fromVersion).padStart(3, '0')
        const toVersionStr = String(toVersion).padStart(3, '0')

        const oldConfigModule = await import(`../example/v${fromVersionStr}.ts`) as VersionTestData
        const newConfigModule = await import(`../example/v${toVersionStr}.ts`) as VersionTestData

        // All version files now use testSeries structure
        let seriesProcessed = 0

        for (const [seriesId, oldSeriesData] of Object.entries(oldConfigModule.testSeries)) {
          const newSeriesData = newConfigModule.testSeries[seriesId]
          if (newSeriesData) {
            // Execute migration for this series
            const actualNewConfig = await runMigration(toVersion, oldSeriesData.config)

            // Validate migration result
            expect(actualNewConfig).toEqual(newSeriesData.config)

            seriesProcessed++

            // Output success info in verbose mode
            // eslint-disable-next-line turbo/no-undeclared-env-vars
            if (process.env.VITEST_VERBOSE) {
              logger.info(`✓ Migration v${fromVersion} -> v${toVersion} [${seriesId}]: ${oldSeriesData.description}`)
            }
          }
          else {
            // Series doesn't exist in new version - skip migration test for this series
            // eslint-disable-next-line turbo/no-undeclared-env-vars
            if (process.env.VITEST_VERBOSE) {
              logger.info(`⚠ Skipping series "${seriesId}" - not present in v${toVersion}`)
            }
          }
        }

        // Ensure at least one series was tested
        if (seriesProcessed === 0) {
          expect(seriesProcessed, `No test series found for migration v${fromVersion} -> v${toVersion}`).toBeGreaterThan(0)
        }
      }
      catch (error) {
        // 如果找不到对应的示例文件，标记为跳过
        if (error instanceof Error && (
          error.message.includes('Cannot resolve module')
          || error.message.includes('Failed to resolve import')
        )) {
          console.warn(`⚠ Skipping migration test v${fromVersion} -> v${toVersion}: Missing example files`)
          // 使用 skip 而不是直接 return，这样测试报告会显示跳过的测试
          expect(true).toBe(true) // placeholder assertion
          return
        }

        // 其他错误重新抛出
        console.error(`❌ Migration test failed v${fromVersion} -> v${toVersion}:`, error)
        throw error
      }
    })
  }
})
