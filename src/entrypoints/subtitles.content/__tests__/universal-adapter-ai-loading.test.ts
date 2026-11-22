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

/** Holds the next access check open; settle it with whether access is granted. */
function holdAccessCheck(): (granted: boolean) => void {
  let settle: (granted: boolean) => void = () => {}
  mocks.ensureAiSubtitlesAccess.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      settle = resolve
    }),
  )
  return (granted) => settle(granted)
}

describe("universalVideoAdapter awaiting AI subtitles", () => {
  it("waits on AI subtitles from the request until their start settles", async () => {
    const { adapter, loadStarted, settleStart } = createAdapterWithPendingStart()
    expect(adapter.isAwaitingAiSubtitles()).toBe(false)

    const request = adapter.requestAiSubtitles()
    await loadStarted()
    expect(adapter.isAwaitingAiSubtitles()).toBe(true)

    // The transcript has arrived, but its translation is still on the way.
    ;(adapter as any).sourceCache.sourceSubtitles = [{ text: "Hello", start: 0, end: 1000 }]
    expect(adapter.isAwaitingAiSubtitles()).toBe(true)

    settleStart(true)
    await request
    expect(adapter.isAwaitingAiSubtitles()).toBe(false)
  })

  it("waits on AI subtitles while the request checks access", async () => {
    const settleAccess = holdAccessCheck()
    const { adapter } = createAdapterWithPendingStart()

    const request = adapter.requestAiSubtitles()
    expect(adapter.isAwaitingAiSubtitles()).toBe(true)
    settleAccess(false)
    await request

    expect(adapter.isAwaitingAiSubtitles()).toBe(false)
  })

  it.each([
    ["turns subtitles off", "toggleSubtitlesManually"],
    ["turns subtitles off by shortcut", "toggleSubtitlesByShortcut"],
  ] as const)("starts no AI subtitles once the reader %s during the checks", async (_, toggle) => {
    const settleAccess = holdAccessCheck()
    const { adapter } = createAdapterWithPendingStart()
    const switchFetcher = vi
      .spyOn((adapter as any).subtitlesSwitch, "switchSubtitlesFetcher")
      .mockResolvedValue(undefined)

    const request = adapter.requestAiSubtitles()
    adapter[toggle](false)
    settleAccess(true)
    await request

    expect(switchFetcher).not.toHaveBeenCalled()
    expect(adapter.isAwaitingAiSubtitles()).toBe(false)
  })

  it("keeps the AI request when subtitles are turned on during the checks", async () => {
    const settleAccess = holdAccessCheck()
    const { adapter } = createAdapterWithPendingStart()
    const switchFetcher = vi.spyOn((adapter as any).subtitlesSwitch, "switchSubtitlesFetcher")

    void adapter.requestAiSubtitles()
    adapter.toggleSubtitlesManually(true)
    settleAccess(true)

    await vi.waitFor(() => expect(switchFetcher).toHaveBeenLastCalledWith("ai"))
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
