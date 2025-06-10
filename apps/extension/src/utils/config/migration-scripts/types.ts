/**
 * Definition of migration function
 */
export type MigrationFunction = (oldConfig: any) => any

/**
 * Interface of migration script module
 */
export interface MigrationModule {
  migrate: MigrationFunction
}

/**
 * Metadata of migration script
 */
export interface MigrationInfo {
  fromVersion: number
  toVersion: number
  description?: string
}
