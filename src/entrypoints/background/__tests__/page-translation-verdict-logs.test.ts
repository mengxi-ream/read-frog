import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { NO_TRANSLATION_SENTINEL } from "@/utils/constants/prompt"
import { captureLogs, logRecord } from "@/utils/logging/testing"

const { handlers, translationCache, batchEnqueue } = vi.hoisted(() => ({
  handlers: new Map<string, (message: unknown) => Promise<unknown>>(),
  translationCache: {
    get: vi.fn<(hash: string) => Promise<{ translation: string; createdAt: Date } | undefined>>(),
    put: vi.fn<(entry: unknown) => Promise<unknown>>(),
    delete: vi.fn<(hash: string) => Promise<void>>(),
  },
  batchEnqueue: vi.fn<(data: unknown) => Promise<string>>(),
}))

vi.mock("@/utils/message", () => ({
  onMessage: (type: string, handler: (message: unknown) => Promise<unknown>) => {
    handlers.set(type, handler)
  },
}))
vi.mock("@/utils/db/dexie/db", () => ({ db: { translationCache } }))
vi.mock("../translation-context-summary", () => ({
  getOrGenerateTranslationContextSummary: vi.fn<() => Promise<undefined>>(),
}))
vi.mock("../translation-queues", () => ({
  createWebPageTranslationQueues: () => ({
    queuesPromise: Promise.resolve({ batchQueue: { enqueue: batchEnqueue }, requestQueue: {} }),
    cancelledScopes: { has: () => false, markScope: () => {} },
  }),
  buildTranslationScopeKey: () => "7:session",
  getQueuedTranslationRouting: () => ({}),
  getLocalProviderConfig: () => null,
  shouldUseBatchQueue: () => true,
}))

const PARAGRAPH = "Changelog entry that came back untranslated"

async function translate() {
  const { setupPageTranslationHandlers } = await import("../page-translation")
  setupPageTranslationHandlers()
  return handlers.get("enqueueTranslateRequest")!({
    data: {
      text: PARAGRAPH,
      langConfig: DEFAULT_CONFIG.language,
      providerRef: {
        kind: "system",
        providerId: "read-frog",
        modelTier: "standard",
        modelRevision: "1",
      },
      scheduleAt: 0,
      hash: "hash",
      sessionId: "session",
    },
    sender: { tab: { id: 7 } },
  })
}

describe("page translation verdict logs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    translationCache.get.mockResolvedValue(undefined)
  })

  it("says when a cached answer was the model's 'no translation needed'", async () => {
    const cachedAt = new Date("2026-11-05T08:00:00.000Z")
    translationCache.get.mockResolvedValue({
      translation: NO_TRANSLATION_SENTINEL,
      createdAt: cachedAt,
    })
    const logs = captureLogs("info")

    await expect(translate()).resolves.toBe(NO_TRANSLATION_SENTINEL)

    expect(logs).toEqual([
      logRecord("info", "Served a cached no-translation verdict", {
        text: expect.objectContaining({ preview: PARAGRAPH }),
        cachedAt: cachedAt.toISOString(),
      }),
    ])
  })

  it("says which model answered 'no translation needed' fresh", async () => {
    batchEnqueue.mockResolvedValue(NO_TRANSLATION_SENTINEL)
    const logs = captureLogs("info")

    await translate()

    expect(logs).toEqual([
      logRecord("info", "The model found no translation needed", {
        text: expect.objectContaining({ preview: PARAGRAPH }),
        provider: "read-frog",
        modelTier: "standard",
      }),
    ])
  })

  it("says nothing about an ordinary translation", async () => {
    batchEnqueue.mockResolvedValue("Une entrée du journal des modifications")
    const logs = captureLogs("info")

    await translate()

    expect(logs).toEqual([])
  })
})
