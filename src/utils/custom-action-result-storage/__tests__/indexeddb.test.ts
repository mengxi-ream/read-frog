import type { CustomActionResultRecord } from "../types"
import { Dexie } from "dexie"
import { IDBKeyRange as FakeIDBKeyRange, indexedDB as fakeIndexedDB } from "fake-indexeddb"
import { afterEach, describe, expect, it } from "vitest"
import {
  createCustomActionResultDatabase,
  CustomActionResultLocalProvider,
  CUSTOM_ACTION_RESULT_DATABASE_VERSION,
} from "../indexeddb"

Dexie.dependencies.indexedDB = fakeIndexedDB
Dexie.dependencies.IDBKeyRange = FakeIDBKeyRange

let databases: ReturnType<typeof createCustomActionResultDatabase>[] = []

function createProvider(name = `custom-action-results-${crypto.randomUUID()}`) {
  const database = createCustomActionResultDatabase(name)
  databases.push(database)
  return { database, provider: new CustomActionResultLocalProvider(database) }
}

function createRecord(id: string, createdAt: number): CustomActionResultRecord {
  return {
    id,
    schemaVersion: 1,
    customActionId: "dictionary-action",
    customActionName: "Dictionary",
    fields: {
      word: "sonder",
      extraNestedField: { confidence: 0.92, labels: ["rare", "literary"] },
      unrecognizedField: "kept intact",
    },
    sourceUrl: "https://example.com/article",
    sourceTitle: "An article",
    createdAt,
    updatedAt: createdAt,
  }
}

afterEach(async () => {
  await Promise.all(
    databases.map(async (database) => {
      database.close()
      await database.delete()
    }),
  )
  databases = []
})

describe("CustomActionResultLocalProvider", () => {
  it("saves, lists, and deletes dynamic result records", async () => {
    const { provider } = createProvider()
    const older = createRecord("11111111-1111-4111-8111-111111111111", 10)
    const newer = createRecord("22222222-2222-4222-8222-222222222222", 20)

    await provider.save([older, newer])

    expect(await provider.list()).toEqual([newer, older])
    await provider.delete(older.id)
    expect(await provider.list()).toEqual([newer])
  })

  it("opens and upgrades a version 1 database by adding the current indexes", async () => {
    const name = `custom-action-results-upgrade-${crypto.randomUUID()}`
    const legacyDatabase = new Dexie(name)
    legacyDatabase.version(1).stores({ records: "id" })
    await legacyDatabase.open()
    legacyDatabase.close()

    const current = createCustomActionResultDatabase(name)
    databases.push(current)
    const provider = new CustomActionResultLocalProvider(current)
    const record = createRecord("33333333-3333-4333-8333-333333333333", 30)
    await provider.save([record])

    expect(current.verno).toBe(CUSTOM_ACTION_RESULT_DATABASE_VERSION)
    expect(await current.records.orderBy("customActionId").toArray()).toEqual([record])
  })
})
