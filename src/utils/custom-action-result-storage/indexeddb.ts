import type { CustomActionResultRecord } from "./types"
import { Dexie, type Table } from "dexie"
import { customActionResultRecordSchema } from "./types"

export const CUSTOM_ACTION_RESULT_DATABASE_NAME = "read-frog-custom-action-results"
export const CUSTOM_ACTION_RESULT_DATABASE_VERSION = 2

type CustomActionResultDatabase = Dexie & {
  records: Table<CustomActionResultRecord, string>
}

export function createCustomActionResultDatabase(
  name = CUSTOM_ACTION_RESULT_DATABASE_NAME,
): CustomActionResultDatabase {
  const database = new Dexie(name) as CustomActionResultDatabase

  // Version 1 stored records without indexes. Version 2 adds the indexes used
  // by the settings list and action-specific lookups without rewriting records.
  database.version(1).stores({ records: "id" })
  database.version(2).stores({ records: "id, customActionId, createdAt, updatedAt" })

  return database
}

export class CustomActionResultLocalProvider {
  constructor(
    private readonly database: CustomActionResultDatabase = createCustomActionResultDatabase(),
  ) {}

  async save(records: CustomActionResultRecord[]): Promise<void> {
    try {
      await this.database.records.bulkPut(records)
    } catch {
      throw new Error("database_error")
    }
  }

  async list(): Promise<CustomActionResultRecord[]> {
    try {
      const records = await this.database.records.orderBy("createdAt").reverse().toArray()
      return records.map((record) => customActionResultRecordSchema.parse(record))
    } catch {
      throw new Error("database_error")
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.database.records.delete(id)
    } catch {
      throw new Error("database_error")
    }
  }

  async close(): Promise<void> {
    this.database.close()
  }
}

export const customActionResultLocalProvider = new CustomActionResultLocalProvider()
