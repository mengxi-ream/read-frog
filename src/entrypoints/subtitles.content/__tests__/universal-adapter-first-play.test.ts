// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NAVIGATION_HANDLER_DELAY, SUBTITLES_SOURCE } from "@/utils/constants/subtitles"
import { UniversalVideoAdapter } from "../universal-adapter"

const mocks = vi.hoisted(() => ({
  getLocalConfig: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/config/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/config/storage")>()
  return {
    ...actual,
    getLocalConfig: mocks.getLocalConfig,
  }
})

vi.mock("@/utils/subtitles/toast", () => ({
  showSubtitlesErrorToast: vi.fn<(...args: any[]) => any>(),
  showAiSubtitlesWallToast: vi.fn<(...args: any[]) => any>(),
}))

function createFetcher() {
  return {
    fetch: vi.fn<(...args: any[]) => any>().mockResolvedValue([]),
    cleanup: vi.fn<(...args: any[]) => any>(),
    shouldUseSameTrack: vi.fn<(...args: any[]) => any>().mockResolvedValue(false),
    getSourceLanguage: () => "en",
    hasAvailableSubtitles: vi.fn<(...args: any[]) => any>().mockResolvedValue(true),
  }
}

function createSchedulerStub(video: HTMLVideoElement) {
  return {
    getVideoElement: () => video,
    start: vi.fn<(...args: any[]) => any>(),
    show: vi.fn<(...args: any[]) => any>(),
    hide: vi.fn<(...args: any[]) => any>(),
    setState: vi.fn<(...args: any[]) => any>(),
    reset: vi.fn<(...args: any[]) => any>(),
    stop: vi.fn<(...args: any[]) => any>(),
    isActive: () => false,
  }
}

async function setUpPausedEmbeddedVideo({ translationStarts = true, isLive = false } = {}) {
  mocks.getLocalConfig.mockResolvedValue({ videoSubtitles: { platforms: { youtube: "auto" } } })
  const adapter = new UniversalVideoAdapter({
    config: {
      platform: "youtube",
      embedded: true,
      selectors: { video: "video", playerContainer: ".player" },
      events: {},
      isLiveContent: () => Promise.resolve(isLive),
    },
    fetchers: { native: createFetcher, ai: createFetcher },
  })
  const video = document.createElement("video")
  const scheduler = createSchedulerStub(video)
  ;(adapter as any).player.subtitlesScheduler = scheduler
  vi.spyOn((adapter as any).starter, "startTranslation").mockResolvedValue(translationStarts)
  const switchSpy = vi.spyOn((adapter as any).subtitlesSwitch, "switchSubtitlesFetcher")
  await (adapter as any).startRequests.tryAutoStartSubtitles()

  return {
    adapter,
    scheduler,
    play: () => video.dispatchEvent(new Event("playing")),
    switchedSources: () => switchSpy.mock.calls.map(([source]) => source),
  }
}

describe("universalVideoAdapter before the first play of an embedded video", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("starts subtitles once on the first play of a paused video", async () => {
    const { play, switchedSources } = await setUpPausedEmbeddedVideo()

    play()
    play()

    expect(switchedSources()).toEqual([SUBTITLES_SOURCE.NATIVE])
  })

  it("keeps the AI subtitles a reader asked for before the first play", async () => {
    const { adapter, play, switchedSources } = await setUpPausedEmbeddedVideo()

    await adapter.requestAiSubtitles()
    play()

    expect(switchedSources()).toEqual([SUBTITLES_SOURCE.AI])
  })

  it("keeps subtitles off after an AI request refused before the first play", async () => {
    const { adapter, play, switchedSources } = await setUpPausedEmbeddedVideo({
      translationStarts: false,
    })

    await adapter.requestAiSubtitles()
    play()

    expect(switchedSources()).toEqual([SUBTITLES_SOURCE.AI])
  })

  it("keeps the first-play start after an AI request refused as live", async () => {
    const { adapter, play, switchedSources } = await setUpPausedEmbeddedVideo({ isLive: true })

    await adapter.requestAiSubtitles()
    play()

    expect(switchedSources()).toEqual([SUBTITLES_SOURCE.NATIVE])
  })

  it.each(["toggleSubtitlesManually", "toggleSubtitlesByShortcut"] as const)(
    "keeps subtitles off when the reader turns them off before the first play (%s)",
    async (toggle) => {
      const { adapter, play, switchedSources } = await setUpPausedEmbeddedVideo()

      adapter[toggle](false)
      play()

      expect(switchedSources()).toEqual([])
    },
  )

  it("does not start a second time subtitles the reader turned on before the first play", async () => {
    const { adapter, play, switchedSources } = await setUpPausedEmbeddedVideo()

    adapter.toggleSubtitlesManually(true)
    play()

    expect(switchedSources()).toEqual([SUBTITLES_SOURCE.NATIVE])
  })

  it.each(["notifyLeave", "notifyNavigation", "destroy"] as const)(
    "drops the first-play start when the page leaves the video or the adapter is destroyed (%s)",
    async (method) => {
      const { adapter, play, switchedSources } = await setUpPausedEmbeddedVideo()
      // Holds back the reinit a navigation schedules.
      vi.useFakeTimers()

      adapter[method]()
      play()

      expect(switchedSources()).toEqual([])
    },
  )

  it("leaves nothing on the old video when an attach finishes during a navigation's wait", async () => {
    const { adapter, scheduler, play, switchedSources } = await setUpPausedEmbeddedVideo()
    vi.useFakeTimers()
    vi.spyOn((adapter as any).player, "attachPlayer").mockResolvedValue(undefined)

    adapter.notifyNavigation()
    // The navigation dropped the scheduler; the attach that finishes now brings one back.
    ;(adapter as any).player.subtitlesScheduler = scheduler
    await (adapter as any).startRequests.tryAutoStartSubtitles()
    await vi.advanceTimersByTimeAsync(NAVIGATION_HANDLER_DELAY)
    play()

    expect(switchedSources()).toEqual([])
  })
})
