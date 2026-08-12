import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"

const statusMock = vi.fn<(...args: any[]) => any>()
const handlers = new Map<string, () => Promise<unknown>>()

vi.mock("@/utils/orpc/background-client", () => ({
  backgroundOrpcClient: {
    hostedAi: { status: (...args: any[]) => statusMock(...args) },
  },
}))

vi.mock("@/utils/message", () => ({
  onMessage: (key: string, handler: () => Promise<unknown>) => {
    handlers.set(key, handler)
  },
}))

const { clearHostedAiStatusCache, setupHostedAiStatusHandler } = await import("../hosted-ai-status")

const TTL_MS = 30_000
const STATUS_A = { credits: [], features: { pageTranslation: { normal: { available: true } } } }
const STATUS_B = { credits: [], features: { pageTranslation: { normal: { available: false } } } }

/** Stands in for session storage, which is what the real cache lives in. */
const store = new Map<string, unknown>()

function ask(): Promise<unknown> {
  const handler = handlers.get("getHostedAiStatus")
  if (!handler) {
    throw new Error("getHostedAiStatus handler was never registered")
  }
  return handler()
}

describe("background hosted AI status cache", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    store.clear()
    storage.getItem = async (key: string) => store.get(key) ?? null
    storage.setItem = async (key: string, value: unknown) => {
      store.set(key, value)
    }
    storage.removeItem = async (key: string) => {
      store.delete(key)
    }
    setupHostedAiStatusHandler()
  })

  it("serves a second ask from the cache instead of going upstream", async () => {
    statusMock.mockResolvedValue(STATUS_A)

    await expect(ask()).resolves.toEqual(STATUS_A)
    await expect(ask()).resolves.toEqual(STATUS_A)

    expect(statusMock).toHaveBeenCalledTimes(1)
  })

  it("refetches once the entry ages past the TTL", async () => {
    const start = Date.now()
    const now = vi.spyOn(Date, "now").mockReturnValue(start)
    statusMock.mockResolvedValue(STATUS_A)
    await ask()

    // Just inside the window: still the cached answer.
    now.mockReturnValue(start + TTL_MS - 1)
    statusMock.mockResolvedValue(STATUS_B)
    await expect(ask()).resolves.toEqual(STATUS_A)
    expect(statusMock).toHaveBeenCalledTimes(1)

    // Past it: a verdict that flipped server-side becomes visible.
    now.mockReturnValue(start + TTL_MS + 1)
    await expect(ask()).resolves.toEqual(STATUS_B)
    expect(statusMock).toHaveBeenCalledTimes(2)
  })

  it("never caches a failure", async () => {
    statusMock.mockRejectedValueOnce(new Error("network down"))

    // Null is "no verdict" — the caller fails open on it.
    await expect(ask()).resolves.toBeNull()

    // A cached failure would pin modelRevision "unknown" into the persistent
    // translation cache keys minted during the window, so the next ask must go
    // upstream again rather than reuse it.
    statusMock.mockResolvedValueOnce(STATUS_A)
    await expect(ask()).resolves.toEqual(STATUS_A)
    expect(statusMock).toHaveBeenCalledTimes(2)
  })

  it("collapses concurrent asks from every tab into one upstream request", async () => {
    let release: (value: unknown) => void = () => {}
    statusMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      }),
    )

    const asks = Promise.all([ask(), ask(), ask()])
    release(STATUS_A)

    expect(await asks).toEqual([STATUS_A, STATUS_A, STATUS_A])
    expect(statusMock).toHaveBeenCalledTimes(1)
  })

  it("drops the entry when the auth identity changes", async () => {
    statusMock.mockResolvedValue(STATUS_A)
    await ask()

    // A guest verdict must not outlive sign-in, and the entry carries no
    // identity of its own to check.
    await clearHostedAiStatusCache()

    statusMock.mockResolvedValue(STATUS_B)
    await expect(ask()).resolves.toEqual(STATUS_B)
    expect(statusMock).toHaveBeenCalledTimes(2)
  })
})
