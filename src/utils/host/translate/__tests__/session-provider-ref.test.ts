// @vitest-environment jsdom
import type { SystemProviderRef } from "@/utils/providers/provider-registry"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import {
  LUNA_PROVIDER_ID,
  SOL_PROVIDER_ID,
  testHostedAiModels,
} from "@/utils/hosted-ai/__tests__/test-models"

// The background answers hosted status; content only asks for it.
const sendMessage = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock("@/utils/message", () => ({
  sendMessage: (...args: unknown[]) => sendMessage(...args),
}))

const { resolvePageProviderRef } = await import("../translate-text")
const { serializeProviderRef } = await import("@/utils/providers/provider-ref")
const {
  beginPageTranslationSession,
  endPageTranslationSession,
  setPageTranslationSessionProviderRef,
} = await import("../translation-session")

const LUNA: SystemProviderRef = {
  kind: "system",
  id: LUNA_PROVIDER_ID,
  name: "GPT-6 Luna",
  model: "gpt-6-luna",
}

const SOL: SystemProviderRef = {
  kind: "system",
  id: SOL_PROVIDER_ID,
  name: "GPT-6.2 Sol",
  model: "gpt-6.2-sol",
}

const tier = {
  accessAllowed: true,
  available: true,
  unavailableReason: null,
  upgradeTo: null,
  modelRevision: "r1",
}

const STATUS = {
  pools: [],
  models: testHostedAiModels(),
  features: { pageTranslation: { normal: tier, advance: tier } },
}

async function storeReasoning(model: string, reasoning: string | undefined) {
  await fakeBrowser.storage.local.set({
    config: { builtInAi: { models: reasoning ? { [model]: { reasoning } } : {} } },
  })
}

function statusFetches() {
  return sendMessage.mock.calls.filter(([type]) => type === "getHostedAiStatus").length
}

/** What start() does: make the ref through the availability check, record it. */
async function startSession(provider: SystemProviderRef, reasoning: string | undefined) {
  const sessionId = beginPageTranslationSession()
  const providerRef = await serializeProviderRef(provider, "pageTranslation")
  setPageTranslationSessionProviderRef(providerRef, reasoning as never)
  return sessionId
}

describe("page translation session ref and the reasoning level", () => {
  beforeEach(() => {
    fakeBrowser.reset()
    sendMessage.mockReset()
    sendMessage.mockResolvedValue(STATUS)
    endPageTranslationSession()
  })

  it("asks at the new level once the user changes it mid-session, then reuses that ref", async () => {
    await storeReasoning("gpt-6-luna", "low")
    const sessionId = await startSession(LUNA, "low")
    expect(statusFetches()).toBe(1)

    await expect(resolvePageProviderRef(LUNA, sessionId, "pageTranslation")).resolves.toMatchObject(
      { reasoning: "low" },
    )
    expect(statusFetches()).toBe(1)

    await storeReasoning("gpt-6-luna", "high")
    await expect(resolvePageProviderRef(LUNA, sessionId, "pageTranslation")).resolves.toMatchObject(
      { providerId: LUNA_PROVIDER_ID, reasoning: "high" },
    )
    expect(statusFetches()).toBe(2)

    // The session took the new ref: later paragraphs fetch nothing.
    await expect(resolvePageProviderRef(LUNA, sessionId, "pageTranslation")).resolves.toMatchObject(
      { reasoning: "high" },
    )
    expect(statusFetches()).toBe(2)
  })

  it("keeps the session's ref when no level is stored and the model's default is sent", async () => {
    const sessionId = await startSession(LUNA, undefined)

    for (let i = 0; i < 3; i++) {
      await expect(
        resolvePageProviderRef(LUNA, sessionId, "pageTranslation"),
      ).resolves.toMatchObject({ reasoning: "none" })
    }
    expect(statusFetches()).toBe(1)
  })

  it("keeps the session's ref when the stored level is one the model doesn't take", async () => {
    // Sol has no "none": the request falls back to its default, "low".
    await storeReasoning("gpt-6.2-sol", "none")
    const sessionId = await startSession(SOL, "none")

    for (let i = 0; i < 3; i++) {
      await expect(
        resolvePageProviderRef(SOL, sessionId, "pageTranslation"),
      ).resolves.toMatchObject({ reasoning: "low" })
    }
    expect(statusFetches()).toBe(1)
  })

  it("does not adopt a ref made for the old level when a newer level was read meanwhile", async () => {
    await storeReasoning("gpt-6-luna", "low")
    const sessionId = await startSession(LUNA, "low")

    // A paragraph reads "medium" and starts a new ref; before its status comes
    // back, the user picks "high" and the next paragraph reads that.
    let answerStatus!: (value: unknown) => void
    sendMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerStatus = resolve
        }),
    )
    await storeReasoning("gpt-6-luna", "medium")
    const first = resolvePageProviderRef(LUNA, sessionId, "pageTranslation")
    await vi.waitFor(() => expect(answerStatus).toBeDefined())
    await storeReasoning("gpt-6-luna", "high")
    const second = resolvePageProviderRef(LUNA, sessionId, "pageTranslation")
    answerStatus(STATUS)
    await first
    await expect(second).resolves.toMatchObject({ reasoning: "high" })

    // The session holds the "high" ref, recorded under "high": no more fetches.
    const fetches = statusFetches()
    await expect(resolvePageProviderRef(LUNA, sessionId, "pageTranslation")).resolves.toMatchObject(
      { reasoning: "high" },
    )
    expect(statusFetches()).toBe(fetches)
  })
})
