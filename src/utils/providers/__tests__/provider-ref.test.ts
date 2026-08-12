import type { SystemProviderRef } from "../provider-registry"
import type { HostedAiStatus, HostedAiTierStatus } from "@/utils/hosted-ai/types"
import { beforeEach, describe, expect, it, vi } from "vitest"

// The background owns the request and its cache; content only asks for it.
const hostedAiStatus = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock("@/utils/message", () => ({
  sendMessage: (...args: unknown[]) => hostedAiStatus(...args),
}))

const { HostedAiProviderUnavailableError, serializeProviderRef } = await import("../provider-ref")

const SYSTEM_PROVIDER: SystemProviderRef = {
  kind: "system",
  id: "read-frog-free-ai",
  name: "Built-in AI",
  modelTier: "normal",
}

function tier(overrides: Partial<HostedAiTierStatus> = {}): HostedAiTierStatus {
  return {
    accessAllowed: true,
    available: true,
    unavailableReason: null,
    requiresUltra: false,
    modelRevision: "normal-r7",
    ...overrides,
  }
}

function status(normal: HostedAiTierStatus = tier()): HostedAiStatus {
  return {
    credits: [],
    features: {
      pageTranslation: { normal, advance: tier({ modelRevision: "advance-r4" }) },
      videoSubtitles: { normal, advance: tier({ modelRevision: "advance-r4" }) },
    } as unknown as HostedAiStatus["features"],
  }
}

/** A promise whose settlement the test controls, so overlap is deterministic. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("serializeProviderRef status coalescing", () => {
  beforeEach(() => {
    hostedAiStatus.mockReset()
  })

  it("asks the background once for callers that overlap, and gives each the same verdict", async () => {
    const gate = deferred<HostedAiStatus>()
    hostedAiStatus.mockReturnValue(gate.promise)

    // Two features and two routes that collapse onto one: nothing about the
    // caller should split the shared request, since one response covers all.
    const refs = Promise.all([
      serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation"),
      serializeProviderRef(SYSTEM_PROVIDER, "videoSubtitles"),
      serializeProviderRef(SYSTEM_PROVIDER, "videoSubtitlesSegmentation"),
    ])

    expect(hostedAiStatus).toHaveBeenCalledTimes(1)

    gate.resolve(status())
    const [page, subtitles, segmentation] = await refs

    expect(hostedAiStatus).toHaveBeenCalledTimes(1)
    for (const ref of [page, subtitles, segmentation]) {
      expect(ref).toEqual({
        kind: "system",
        providerId: "read-frog-free-ai",
        modelTier: "normal",
        modelRevision: "normal-r7",
      })
    }
  })

  it("refetches once the shared request settles, so a quota that runs out mid-page is seen", async () => {
    hostedAiStatus.mockResolvedValueOnce(status())
    await serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation")

    // The next caller does not overlap the first, so it must get a fresh
    // verdict rather than a retained one — this is coalescing, not caching.
    hostedAiStatus.mockResolvedValueOnce(
      status(tier({ available: false, unavailableReason: "quota_exhausted" })),
    )
    await expect(serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation")).rejects.toBeInstanceOf(
      HostedAiProviderUnavailableError,
    )

    expect(hostedAiStatus).toHaveBeenCalledTimes(2)
  })

  it("rejects every overlapping caller on an explicit unavailable verdict", async () => {
    const gate = deferred<HostedAiStatus>()
    hostedAiStatus.mockReturnValue(gate.promise)

    const results = Promise.allSettled([
      serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation"),
      serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation"),
    ])

    gate.resolve(status(tier({ available: false, unavailableReason: "quota_exhausted" })))

    for (const result of await results) {
      expect(result.status).toBe("rejected")
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(
        HostedAiProviderUnavailableError,
      )
    }
    expect(hostedAiStatus).toHaveBeenCalledTimes(1)
  })

  it("fails open for every overlapping caller when the background has no verdict", async () => {
    // The background catches its own fetch failure and answers null; content
    // must treat that the same as "no verdict", not as a denial.
    const gate = deferred<HostedAiStatus | null>()
    hostedAiStatus.mockReturnValue(gate.promise)

    const refs = Promise.all([
      serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation"),
      serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation"),
    ])

    gate.resolve(null)

    // No verdict means no block: the generation endpoints enforce access.
    for (const ref of await refs) {
      expect(ref).toMatchObject({ kind: "system", modelRevision: "unknown" })
    }

    // The empty answer must not be retained either, or one outage would pin
    // every later call to the fail-open path.
    hostedAiStatus.mockResolvedValueOnce(status())
    await expect(serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation")).resolves.toMatchObject({
      modelRevision: "normal-r7",
    })
    expect(hostedAiStatus).toHaveBeenCalledTimes(2)
  })

  it("fails open when the message itself cannot be delivered", async () => {
    hostedAiStatus.mockRejectedValueOnce(new Error("no receiving end"))

    await expect(serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation")).resolves.toMatchObject({
      kind: "system",
      modelRevision: "unknown",
    })
  })

  it("never reaches the status endpoint for a local provider", async () => {
    const local = { provider: "openai", id: "openai-1" } as never

    await expect(serializeProviderRef(local, "pageTranslation")).resolves.toEqual({
      kind: "local",
      config: local,
    })
    expect(hostedAiStatus).not.toHaveBeenCalled()
  })
})
