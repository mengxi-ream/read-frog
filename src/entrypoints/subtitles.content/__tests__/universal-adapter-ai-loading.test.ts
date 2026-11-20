import { describe, expect, it, vi } from "vitest"
import { UniversalVideoAdapter } from "../universal-adapter"

const mocks = vi.hoisted(() => ({
  ensureAiSubtitlesAccess: vi.fn<() => Promise<boolean>>(async () => true),
}))

vi.mock("@/utils/subtitles/ai/access-guard", () => ({
  ensureAiSubtitlesAccess: mocks.ensureAiSubtitlesAccess,
}))

function createFetcher() {
  return {
    fetch: async () => [],
    cleanup: () => {},
    shouldUseSameTrack: async () => false,
    getSourceLanguage: () => "en",
    hasAvailableSubtitles: async () => true,
  }
}

function createScheduler() {
  let active = false
  return {
    start: () => {
      active = true
    },
    show: () => {
      active = true
    },
    hide: () => {
      active = false
    },
    setState: () => {},
    isActive: () => active,
  }
}

function createAdapterWithPendingStart() {
  const adapter = new UniversalVideoAdapter({
    config: {
      platform: "xcom",
      selectors: { video: "video", playerContainer: ".player" },
      events: {},
    },
    fetchers: { native: createFetcher, ai: createFetcher },
  })
  ;(adapter as any).player.subtitlesScheduler = createScheduler()
  let resolveStart: (loaded: boolean) => void = () => {}
  const startTranslation = vi
    .spyOn((adapter as any).starter, "startTranslation")
    .mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveStart = resolve
        }),
    )
  return {
    adapter,
    loadStarted: () => vi.waitFor(() => expect(startTranslation).toHaveBeenCalled()),
    settleStart: (loaded: boolean) => resolveStart(loaded),
  }
}

describe("universalVideoAdapter awaiting AI subtitles", () => {
  it("waits on AI subtitles from the request until they arrive", async () => {
    const { adapter, loadStarted } = createAdapterWithPendingStart()
    expect(adapter.isAwaitingAiSubtitles()).toBe(false)

    void adapter.requestAiSubtitles()
    await loadStarted()
    expect(adapter.isAwaitingAiSubtitles()).toBe(true)

    ;(adapter as any).sourceCache.sourceSubtitles = [{ text: "Hello", start: 0, end: 1000 }]
    expect(adapter.isAwaitingAiSubtitles()).toBe(false)
  })

  it("waits on AI subtitles while the request checks access", async () => {
    let settleAccess: (granted: boolean) => void = () => {}
    mocks.ensureAiSubtitlesAccess.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        settleAccess = resolve
      }),
    )
    const { adapter } = createAdapterWithPendingStart()

    const request = adapter.requestAiSubtitles()
    expect(adapter.isAwaitingAiSubtitles()).toBe(true)
    settleAccess(false)
    await request

    expect(adapter.isAwaitingAiSubtitles()).toBe(false)
  })

  it("stops waiting once the request is refused", async () => {
    const { adapter, loadStarted, settleStart } = createAdapterWithPendingStart()

    const request = adapter.requestAiSubtitles()
    await loadStarted()
    settleStart(false)
    await request

    expect(adapter.isAwaitingAiSubtitles()).toBe(false)
  })

  it("stops waiting once the reader turns subtitles off", async () => {
    const { adapter, loadStarted } = createAdapterWithPendingStart()

    void adapter.requestAiSubtitles()
    await loadStarted()
    adapter.toggleSubtitlesManually(false)

    expect(adapter.isAwaitingAiSubtitles()).toBe(false)
  })
})
