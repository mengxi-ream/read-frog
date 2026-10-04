import type {
  CustomActionResultRecord,
  CustomActionResultStorageSettings,
  WebDavStorageSettings,
} from "../types"
import type { CustomActionResultWebDavProvider } from "../webdav"
import { describe, expect, it, vi } from "vitest"
import { saveCustomActionResults } from "../service"

const request = {
  actionId: "dictionary-action",
  actionName: "Dictionary",
  results: [
    {
      word: "sonder",
      meaning: "the realization that each passerby has a life as vivid as your own",
      unknownStructuredField: { score: 0.98, tags: ["noun", "rare"] },
      futureField: ["kept", { nested: true }],
    },
  ],
  sourceUrl: "https://example.com/words/sonder",
  sourceTitle: "A page of words",
  now: 1234,
}

function createDependencies(provider: CustomActionResultStorageSettings["provider"]) {
  const settings: CustomActionResultStorageSettings = {
    provider,
    webDav: {
      serverUrl: "https://dav.example.test",
      directory: "Read Frog",
      username: "",
      password: "",
    },
  }
  const localProvider = {
    save: vi.fn<(records: CustomActionResultRecord[]) => Promise<void>>(async () => {}),
    list: vi.fn<() => Promise<CustomActionResultRecord[]>>(async () => []),
    delete: vi.fn<(id: string) => Promise<void>>(async () => {}),
  }
  const webDavProvider = {
    save: vi.fn<(records: CustomActionResultRecord[]) => Promise<void>>(async () => {}),
    list: vi.fn<() => Promise<CustomActionResultRecord[]>>(async () => []),
    delete: vi.fn<(id: string) => Promise<void>>(async () => {}),
    testConnection: vi.fn<() => Promise<void>>(async () => {}),
  }

  return {
    dependencies: {
      getSettings: vi.fn<() => Promise<CustomActionResultStorageSettings>>(async () => settings),
      localProvider,
      createWebDavProvider: vi.fn<
        (
          settings: WebDavStorageSettings,
        ) => Pick<CustomActionResultWebDavProvider, "save" | "list" | "delete" | "testConnection">
      >(() => webDavProvider),
    },
    localProvider,
  }
}

describe("Custom Action result storage service", () => {
  it("passes every dynamic result field and source metadata to the local provider", async () => {
    const setup = createDependencies("local")
    const result = await saveCustomActionResults(request, setup.dependencies)

    expect(result).toMatchObject({ ok: true, value: 1 })
    const [records] = setup.localProvider.save.mock.calls[0] ?? []
    expect(records).toHaveLength(1)
    expect(records?.[0]).toMatchObject({
      schemaVersion: 1,
      customActionId: request.actionId,
      customActionName: request.actionName,
      fields: request.results[0],
      sourceUrl: request.sourceUrl,
      sourceTitle: request.sourceTitle,
      createdAt: request.now,
      updatedAt: request.now,
    })
    expect(records?.[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(setup.dependencies.createWebDavProvider).not.toHaveBeenCalled()
  })

  it("refuses the local provider route when Notebase is selected", async () => {
    const setup = createDependencies("notebase")
    const result = await saveCustomActionResults(request, setup.dependencies)

    expect(result).toEqual({ ok: false, error: "unsupported_provider" })
    expect(setup.localProvider.save).not.toHaveBeenCalled()
    expect(setup.dependencies.createWebDavProvider).not.toHaveBeenCalled()
  })
})
