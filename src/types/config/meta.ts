import type { Config } from './config'

/**
 * Metadata stored with config via WXT storage.setMeta
 */
export interface ConfigMetaFields {
  schemaVersion: number
  lastModifiedAt: number
}

export interface ConfigMeta extends ConfigMetaFields, Record<string, unknown> {}

export interface ConfigValueAndMeta {
  value: Config
  meta: ConfigMeta
}

/**
 * Metadata stored with lastSyncedConfig via WXT storage.setMeta
 */
export interface LastSyncedConfigMetaFields {
  schemaVersion: number
  lastModifiedAt: number
  lastSyncedAt: number
  email: string
}

export interface LastSyncedConfigMeta extends LastSyncedConfigMetaFields, Record<string, unknown> {}

export interface LastSyncedConfigValueAndMeta {
  value: Config
  meta: LastSyncedConfigMeta
}
