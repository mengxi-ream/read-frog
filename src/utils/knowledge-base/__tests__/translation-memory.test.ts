import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const items: any[] = []
const events: any[] = []
const queue: any[] = []

const fetchMock = vi.fn()

function createTable(store: any[]) {
  return {
    put: vi.fn(async (value: any) => {
      const key = value.id
      const index = store.findIndex(item => item.id === key)
      if (index >= 0) {
        store[index] = value
      }
      else {
        store.push(value)
      }
    }),
    clear: vi.fn(async () => {
      store.splice(0)
    }),
    count: vi.fn(async () => store.length),
    delete: vi.fn(async (id: string) => {
      const index = store.findIndex(item => item.id === id)
      if (index >= 0) {
        store.splice(index, 1)
      }
    }),
    where: vi.fn((field: string) => ({
      equals: (value: unknown) => ({
        first: vi.fn(async () => store.find(item => item[field] === value)),
      }),
    })),
    orderBy: vi.fn((field: string) => ({
      toArray: vi.fn(async () => [...store].sort((a, b) => Number(a[field]) - Number(b[field]))),
      limit: (count: number) => ({
        toArray: vi.fn(async () => [...store].sort((a, b) => Number(a[field]) - Number(b[field])).slice(0, count)),
      }),
    })),
  }
}

const translationMemoryItemsTable = createTable(items)
const translationMemoryEventsTable = createTable(events)
const knowledgeSyncQueueTable = createTable(queue)

vi.mock("@/utils/db/dexie/db", () => ({
  db: {
    translationMemoryItems: translationMemoryItemsTable,
    translationMemoryEvents: translationMemoryEventsTable,
    knowledgeSyncQueue: knowledgeSyncQueueTable,
  },
}))

const microsoftProvider: ProviderConfig = {
  id: "microsoft-translate-default",
  name: "Microsoft Translate",
  provider: "microsoft-translate",
  enabled: true,
}

function createConfig(patch: Partial<Config["knowledgeBase"]> = {}): Config {
  return {
    ...DEFAULT_CONFIG,
    knowledgeBase: {
      ...DEFAULT_CONFIG.knowledgeBase,
      ...patch,
      remoteSync: {
        ...DEFAULT_CONFIG.knowledgeBase.remoteSync,
        ...patch.remoteSync,
      },
    },
  }
}

describe("translation memory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    items.splice(0)
    events.splice(0)
    queue.splice(0)
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: "OK" })
    vi.stubGlobal("fetch", fetchMock)
  })

  it("adds a translation memory item and event", async () => {
    const { recordTranslationMemory, getTranslationMemoryStats } = await import("../translation-memory")

    await recordTranslationMemory({
      sourceText: " Hello   world ",
      translatedText: "你好，世界",
      sourceLang: "eng",
      targetLang: "cmn",
      providerConfig: microsoftProvider,
      surface: "page",
      url: "https://example.com",
      title: "Example",
      contextText: "Hello world",
    }, createConfig())

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      sourceText: "Hello world",
      translatedText: "你好，世界",
      sourceLang: "eng",
      targetLang: "cmn",
      providerId: "microsoft-translate-default",
      useCount: 1,
      surfaces: ["page"],
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      itemId: items[0].id,
      surface: "page",
      url: "https://example.com",
      title: "Example",
    })
    await expect(getTranslationMemoryStats()).resolves.toEqual({
      itemCount: 1,
      eventCount: 1,
      queuedSyncCount: 0,
    })
  })

  it("updates use count for the same source target and provider", async () => {
    const { recordTranslationMemory } = await import("../translation-memory")
    const config = createConfig()

    await recordTranslationMemory({
      sourceText: "Hello world",
      translatedText: "你好，世界",
      sourceLang: "eng",
      targetLang: "cmn",
      providerConfig: microsoftProvider,
      surface: "page",
    }, config)
    await recordTranslationMemory({
      sourceText: "Hello   world",
      translatedText: "你好世界",
      sourceLang: "eng",
      targetLang: "cmn",
      providerConfig: microsoftProvider,
      surface: "selection",
    }, config)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      translatedText: "你好世界",
      useCount: 2,
      surfaces: ["page", "selection"],
    })
    expect(events).toHaveLength(2)
  })

  it("creates a separate item for a different target language", async () => {
    const { recordTranslationMemory } = await import("../translation-memory")
    const config = createConfig()

    await recordTranslationMemory({
      sourceText: "Hello world",
      translatedText: "你好，世界",
      sourceLang: "eng",
      targetLang: "cmn",
      providerConfig: microsoftProvider,
      surface: "page",
    }, config)
    await recordTranslationMemory({
      sourceText: "Hello world",
      translatedText: "Hola mundo",
      sourceLang: "eng",
      targetLang: "spa",
      providerConfig: microsoftProvider,
      surface: "page",
    }, config)

    expect(items).toHaveLength(2)
  })

  it("does not record when disabled", async () => {
    const { recordTranslationMemory } = await import("../translation-memory")

    await recordTranslationMemory({
      sourceText: "Hello world",
      translatedText: "你好，世界",
      sourceLang: "eng",
      targetLang: "cmn",
      providerConfig: microsoftProvider,
      surface: "page",
    }, createConfig({ enabled: false }))

    expect(items).toHaveLength(0)
    expect(events).toHaveLength(0)
  })

  it("queues failed remote sync payloads", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" })
    const { recordTranslationMemory } = await import("../translation-memory")

    await recordTranslationMemory({
      sourceText: "Hello world",
      translatedText: "你好，世界",
      sourceLang: "eng",
      targetLang: "cmn",
      providerConfig: microsoftProvider,
      surface: "page",
    }, createConfig({
      remoteSync: {
        enabled: true,
        endpoint: "https://example.com/api/memory",
        token: "secret",
      },
    }))

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api/memory",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret",
        }),
      }),
    )
    expect(queue).toHaveLength(1)
  })

  it("removes queued sync items after retry success", async () => {
    const { retryKnowledgeSyncQueue } = await import("../translation-memory")
    queue.push({
      id: "queued-1",
      payload: {
        schemaVersion: 1,
        sourceApp: "readfrog",
        item: {
          id: "item-1",
          sourceText: "Hello",
          translatedText: "你好",
          sourceLang: "eng",
          targetLang: "cmn",
          normalizedSourceHash: "hash",
          providerId: "provider",
          provider: "test",
          model: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          lastUsedAt: new Date(0).toISOString(),
          useCount: 1,
        },
        event: {
          id: "event-1",
          itemId: "item-1",
          surface: "page",
          createdAt: new Date(0).toISOString(),
        },
      },
      createdAt: new Date(0),
      updatedAt: new Date(0),
      attempts: 0,
    })

    await retryKnowledgeSyncQueue(createConfig({
      remoteSync: {
        enabled: true,
        endpoint: "https://example.com/api/memory",
        token: "",
      },
    }))

    expect(queue).toHaveLength(0)
  })
})
