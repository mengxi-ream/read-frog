// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NO_TRANSLATION_SENTINEL } from "@/utils/constants/prompt"
import { sendMessage } from "@/utils/message"
import { TranslationCancelledError } from "@/utils/request/cancellation"
import {
  clearInMemoryTranslationCache,
  getInMemoryTranslation,
  IN_MEMORY_TRANSLATION_CACHE_MAX_ENTRIES,
  storeInMemoryTranslation,
} from "../in-memory-translation-cache"
import { translateTextCore } from "../translate-text"
import { beginPageTranslationSession, endPageTranslationSession } from "../translation-session"

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn<(...args: any[]) => any>(),
}))

// Non-LLM provider so hash building stays prompt-free and the pipeline needs
// no config storage; the memory tier itself is provider-agnostic.
const googleProviderConfig = {
  kind: "local" as const,
  id: "google-translate-default",
  name: "Google Translate",
  config: {
    id: "google-translate-default",
    enabled: true,
    name: "Google Translate",
    provider: "google-translate" as const,
  },
} as never

const langConfig = {
  sourceCode: "eng" as const,
  targetCode: "cmn" as const,
  level: "intermediate" as const,
}

const sendMessageMock = vi.mocked(sendMessage)

function setup() {
  // Module-level state survives across tests in this file: drop any session
  // and cached entries a previous test left behind.
  endPageTranslationSession()
  clearInMemoryTranslationCache()

  const sessionId = beginPageTranslationSession()
  const translate = (text: string, overrides: Record<string, unknown> = {}) =>
    translateTextCore({
      text,
      langConfig,
      providerConfig: googleProviderConfig,
      hostedFeature: "pageTranslation",
      sessionId,
      ...overrides,
    })

  return { translate }
}

describe("in-memory translation tier in translateTextCore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("serves a repeated page request from memory without a second background round trip", async () => {
    const { translate } = setup()
    sendMessageMock.mockResolvedValue("你好")

    await expect(translate("Hello")).resolves.toBe("你好")
    await expect(translate("Hello")).resolves.toBe("你好")

    // A virtualized page recreating its nodes re-runs this exact call; the
    // second run must not pay the message round trip again.
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it("misses when the request identity differs", async () => {
    const { translate } = setup()
    sendMessageMock.mockResolvedValueOnce("你好").mockResolvedValueOnce("こんにちは")

    await expect(translate("Hello")).resolves.toBe("你好")
    await expect(
      translate("Hello", { langConfig: { ...langConfig, targetCode: "jpn" as const } }),
    ).resolves.toBe("こんにちは")

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
  })

  it("does not cache outside a page-translation session", async () => {
    const { translate } = setup()
    sendMessageMock.mockResolvedValue("你好")

    await expect(translate("Hello", { sessionId: undefined })).resolves.toBe("你好")
    await expect(translate("Hello", { sessionId: undefined })).resolves.toBe("你好")

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
  })

  it("forceRetranslation bypasses the read but refreshes the stored entry", async () => {
    const { translate } = setup()
    sendMessageMock.mockResolvedValueOnce("旧译文").mockResolvedValueOnce("新译文")

    await expect(translate("Hello")).resolves.toBe("旧译文")
    await expect(translate("Hello", { forceRetranslation: true })).resolves.toBe("新译文")
    // The forced result must replace the remembered one, or a later remount
    // would resurrect the translation the user explicitly replaced.
    await expect(translate("Hello")).resolves.toBe("新译文")

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
  })

  it("remembers the no-translation sentinel as an empty result", async () => {
    const { translate } = setup()
    sendMessageMock.mockResolvedValue(NO_TRANSLATION_SENTINEL)

    await expect(translate("Hello")).resolves.toBe("")
    await expect(translate("Hello")).resolves.toBe("")

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it("does not memorize empty results", async () => {
    const { translate } = setup()
    sendMessageMock.mockResolvedValue("")

    await expect(translate("Hello")).resolves.toBe("")
    await expect(translate("Hello")).resolves.toBe("")

    // An empty result must stay retryable, mirroring the background's
    // truthy-only cache write.
    expect(sendMessageMock).toHaveBeenCalledTimes(2)
  })

  it("throws for a cancelled session instead of serving from memory", async () => {
    const { translate } = setup()
    sendMessageMock.mockResolvedValue("你好")

    await expect(translate("Hello")).resolves.toBe("你好")
    endPageTranslationSession()

    await expect(translate("Hello")).rejects.toBeInstanceOf(TranslationCancelledError)
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })
})

describe("in-memory translation cache store", () => {
  it("evicts the least recently used entry past the cap", () => {
    clearInMemoryTranslationCache()

    for (let i = 0; i < IN_MEMORY_TRANSLATION_CACHE_MAX_ENTRIES; i++) {
      storeInMemoryTranslation(`hash-${i}`, `t-${i}`)
    }
    // Touch the oldest entry so recency, not insertion order, decides.
    expect(getInMemoryTranslation("hash-0")).toBe("t-0")

    storeInMemoryTranslation("hash-overflow", "t-overflow")

    expect(getInMemoryTranslation("hash-0")).toBe("t-0")
    expect(getInMemoryTranslation("hash-1")).toBeUndefined()
    expect(getInMemoryTranslation("hash-overflow")).toBe("t-overflow")
  })

  it("ignores empty translations", () => {
    clearInMemoryTranslationCache()

    storeInMemoryTranslation("hash-empty", "")
    expect(getInMemoryTranslation("hash-empty")).toBeUndefined()
  })
})
