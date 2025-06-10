import type { MigrationFunction, MigrationModule } from './migration-scripts/types'
import { CONFIG_SCHEMA_VERSION } from '../constants/config'

export const LATEST_SCHEMA_VERSION = CONFIG_SCHEMA_VERSION

// 自动发现和导入所有迁移脚本
async function discoverMigrations(): Promise<Record<number, MigrationFunction>> {
  const migrations: Record<number, MigrationFunction> = {}

  // 使用动态导入来加载迁移脚本
  const migrationModules = import.meta.glob('./migration-scripts/v*.ts')

  for (const [path, importFn] of Object.entries(migrationModules)) {
    try {
      // 从文件路径提取版本号
      const match = path.match(/v(\d{3})-to-v(\d{3})\.ts$/)
      if (match) {
        const toVersion = Number.parseInt(match[2], 10)
        const module = await importFn() as MigrationModule
        const migrationFn = module.migrate

        if (typeof migrationFn === 'function') {
          migrations[toVersion] = migrationFn
        }
        else {
          console.warn(`Migration file ${path} does not export a valid migrate function`)
        }
      }
      else {
        console.warn(`Migration file ${path} does not follow naming convention v{from}-to-v{to}.ts`)
      }
    }
    catch (error) {
      console.error(`Failed to load migration from ${path}:`, error)
    }
  }

  return migrations
}

// 缓存迁移函数以避免重复加载
let _migrationsCache: Record<number, MigrationFunction> | null = null

// 获取所有可用的迁移函数
export async function getMigrations(): Promise<Record<number, MigrationFunction>> {
  if (!_migrationsCache) {
    _migrationsCache = await discoverMigrations()
  }
  return _migrationsCache
}

// 执行单个迁移
export async function runMigration(version: number, config: any): Promise<any> {
  const migrations = await getMigrations()
  const migrationFn = migrations[version]

  if (!migrationFn) {
    throw new Error(`Migration function for version ${version} not found`)
  }

  return migrationFn(config)
}

// 清除迁移缓存（主要用于测试）
export function clearMigrationsCache(): void {
  _migrationsCache = null
}
