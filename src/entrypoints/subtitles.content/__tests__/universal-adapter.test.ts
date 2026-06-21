import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NAVIGATION_HANDLER_DELAY } from "@/utils/constants/subtitles"
import { UniversalVideoAdapter } from "../universal-adapter"

const mocks = vi.hoisted(() => ({
  getLocalConfig: vi.fn(),
  TranslationCoordinator: vi.fn(),
  translationCoordinatorClearFailed: vi.fn(),
  translationCoordinatorStart: vi.fn(),
  translationCoordinatorStop: vi.fn(),
}))

vi.mock("@/utils/config/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/config/storage")>()
  return {
    ...actual,
    getLocalConfig: mocks.getLocalConfig,
  }
})

vi.mock("../translation-coordinator", () => ({
  TranslationCoordinator: mocks.TranslationCoordinator,
}))

function createAdapter(fetchResult: Array<{ text: string, start: number, end: number }>) {
  const subtitlesFetcher = {
    fetch: vi.fn().mockResolvedValue(fetchResult),
    cleanup: vi.fn(),
    shouldUseSameTrack: vi.fn().mockResolvedValue(false),
    getSourceLanguage: () => "en",
    hasAvailableSubtitles: vi.fn().mockResolvedValue(true),
  }

  const adapter = new UniversalVideoAdapter({
    config: {
      selectors: {
        video: "video",
        playerContainer: ".player",
        controlsBar: ".controls",
        nativeSubtitles: ".native-subtitles",
      },
      events: {},
    },
    subtitlesFetcher,
  })

  return { adapter, subtitlesFetcher }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

function attachScheduler(adapter: UniversalVideoAdapter, active: boolean) {
  const subtitlesScheduler = {
    getVideoElement: vi.fn(() => document.createElement("video")),
    getState: vi.fn(() => "idle"),
    hide: vi.fn(),
    isActive: vi.fn(() => active),
    reset: vi.fn(),
    show: vi.fn(),
    start: vi.fn(),
    supplementSubtitles: vi.fn(),
    stop: vi.fn(),
    setState: vi.fn(),
  }

  ;(adapter as any).subtitlesScheduler = subtitlesScheduler
  return subtitlesScheduler
}

describe("universalVideoAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Constructor mocks cannot be arrows because the adapter instantiates this class with `new`.
    // eslint-disable-next-line prefer-arrow-callback
    mocks.TranslationCoordinator.mockImplementation(function () {
      return {
        clearFailed: mocks.translationCoordinatorClearFailed,
        start: mocks.translationCoordinatorStart,
        stop: mocks.translationCoordinatorStop,
      }
    })
    vi.stubGlobal("document", { title: "Test video" })
    mocks.getLocalConfig.mockResolvedValue({
      language: {},
      providersConfig: [],
      translate: {
        enableAIContentAware: false,
      },
      videoSubtitles: {
        aiSegmentation: false,
        providerId: null,
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps raw source subtitles and rebuilds processed source subtitles", async () => {
    const subtitles = [
      { text: "I agree.", start: 0, end: 500 },
      { text: "It is true.", start: 500, end: 1000 },
      { text: "We can do this.", start: 1000, end: 1500 },
      { text: "Let's ship now.", start: 1500, end: 2000 },
    ]
    const { adapter } = createAdapter(subtitles)

    await (adapter as any).getOrLoadSourceSubtitles()

    expect((adapter as any).sourceSubtitles).toEqual(subtitles)
    expect((adapter as any).sourceProcessedSubtitles).toEqual([
      {
        text: "I agree. It is true. We can do this. Let's ship now.",
        start: 0,
        end: 2000,
      },
    ])
  })

  it("reloads subtitles when the source track changes while translation is enabled", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([
      { text: "hello", start: 0, end: 500 },
    ])
    ;(subtitlesFetcher as any).hideNativeSubtitles = vi.fn()

    const subtitlesScheduler = attachScheduler(adapter, true)

    const clearRuntimeSessionSpy = vi.spyOn(adapter as any, "clearRuntimeSession")
    const clearSourceCacheSpy = vi.spyOn(adapter as any, "clearSourceCache")
    const startTranslationSpy = vi.spyOn(adapter as any, "startTranslation").mockResolvedValue(undefined)

    await adapter.handleSourceTrackChanged()

    expect((subtitlesFetcher as any).hideNativeSubtitles).toHaveBeenCalledTimes(1)
    expect(subtitlesFetcher.shouldUseSameTrack).toHaveBeenCalledTimes(1)
    expect(clearRuntimeSessionSpy).toHaveBeenCalledTimes(1)
    expect(clearSourceCacheSpy).toHaveBeenCalledTimes(1)
    expect(subtitlesFetcher.cleanup).toHaveBeenCalledTimes(1)
    expect(subtitlesScheduler.reset).toHaveBeenCalledTimes(1)
    expect(subtitlesScheduler.setState).toHaveBeenCalledWith("loading")
    expect(startTranslationSpy).toHaveBeenCalledTimes(1)
  })

  it("ignores source track changes when translation is disabled", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([
      { text: "hello", start: 0, end: 500 },
    ])

    attachScheduler(adapter, false)
    const startTranslationSpy = vi.spyOn(adapter as any, "startTranslation").mockResolvedValue(undefined)

    await adapter.handleSourceTrackChanged()

    expect(subtitlesFetcher.shouldUseSameTrack).not.toHaveBeenCalled()
    expect(startTranslationSpy).not.toHaveBeenCalled()
  })

  it("delegates native subtitle visibility to fetcher hooks", () => {
    const { adapter, subtitlesFetcher } = createAdapter([])
    const style = {
      remove: vi.fn(),
    }
    const getElementById = vi.fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(style)
    ;(document as any).getElementById = getElementById
    ;(document as any).createElement = vi.fn(() => ({}))
    ;(document as any).head = { appendChild: vi.fn() }
    ;(subtitlesFetcher as any).hideNativeSubtitles = vi.fn()
    ;(subtitlesFetcher as any).showNativeSubtitles = vi.fn()

    ;(adapter as any).hideNativeSubtitles()
    ;(adapter as any).showNativeSubtitles()

    expect((subtitlesFetcher as any).hideNativeSubtitles).toHaveBeenCalledTimes(1)
    expect((subtitlesFetcher as any).showNativeSubtitles).toHaveBeenCalledTimes(1)
    expect(style.remove).toHaveBeenCalledTimes(1)
  })

  it("does not reload subtitles when the selected track is unchanged", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([
      { text: "hello", start: 0, end: 500 },
    ])

    const subtitlesScheduler = attachScheduler(adapter, true)
    vi.mocked(subtitlesFetcher.shouldUseSameTrack).mockResolvedValue(true)

    const startTranslationSpy = vi.spyOn(adapter as any, "startTranslation").mockResolvedValue(undefined)

    await adapter.handleSourceTrackChanged()

    expect(subtitlesFetcher.shouldUseSameTrack).toHaveBeenCalledTimes(1)
    expect(subtitlesFetcher.cleanup).not.toHaveBeenCalled()
    expect(subtitlesScheduler.reset).not.toHaveBeenCalled()
    expect(subtitlesScheduler.setState).not.toHaveBeenCalled()
    expect(startTranslationSpy).not.toHaveBeenCalled()
  })

  it("reruns a pending source track refresh when another track change arrives", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([
      { text: "hello", start: 0, end: 500 },
    ])
    ;(subtitlesFetcher as any).hideNativeSubtitles = vi.fn()
    const firstSameTrack = createDeferred<boolean>()
    vi.mocked(subtitlesFetcher.shouldUseSameTrack)
      .mockReturnValueOnce(firstSameTrack.promise)
      .mockResolvedValue(false)

    attachScheduler(adapter, true)
    const startTranslationSpy = vi.spyOn(adapter as any, "startTranslation").mockResolvedValue(undefined)

    const firstRefresh = adapter.handleSourceTrackChanged()
    await vi.waitFor(() => {
      expect(subtitlesFetcher.shouldUseSameTrack).toHaveBeenCalledTimes(1)
    })
    const queuedRefresh = adapter.handleSourceTrackChanged()

    firstSameTrack.resolve(false)
    await Promise.all([firstRefresh, queuedRefresh])

    expect((subtitlesFetcher as any).hideNativeSubtitles).toHaveBeenCalledTimes(2)
    expect(subtitlesFetcher.shouldUseSameTrack).toHaveBeenCalledTimes(2)
    expect(startTranslationSpy).toHaveBeenCalledTimes(2)
  })

  it("does not restart a pending source track refresh after subtitles are disabled", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([
      { text: "hello", start: 0, end: 500 },
    ])
    const deferredSameTrack = createDeferred<boolean>()
    vi.mocked(subtitlesFetcher.shouldUseSameTrack).mockReturnValue(deferredSameTrack.promise)

    const subtitlesScheduler = attachScheduler(adapter, true)
    const startTranslationSpy = vi.spyOn(adapter as any, "startTranslation").mockResolvedValue(undefined)

    const refreshPromise = adapter.handleSourceTrackChanged()
    await vi.waitFor(() => {
      expect(subtitlesFetcher.shouldUseSameTrack).toHaveBeenCalledTimes(1)
    })

    adapter.toggleSubtitlesManually(false)
    deferredSameTrack.resolve(false)
    await refreshPromise

    expect(subtitlesScheduler.reset).not.toHaveBeenCalled()
    expect(subtitlesScheduler.setState).not.toHaveBeenCalledWith("loading")
    expect(startTranslationSpy).not.toHaveBeenCalled()
  })

  it("delegates translated subtitle downloads to the downloader", async () => {
    const { adapter } = createAdapter([])
    const downloader = {
      download: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    }
    ;(adapter as any).translatedSubtitlesDownloader = downloader

    await adapter.downloadTranslatedSubtitles()

    expect(downloader.download).toHaveBeenCalledTimes(1)
  })

  it("can force a navigation rebind before any subtitle session has started", async () => {
    vi.useFakeTimers()
    const { adapter } = createAdapter([])
    attachScheduler(adapter, false)

    const resetForNavigationSpy = vi.spyOn(adapter as any, "resetForNavigation")
    const renderTranslateButtonSpy = vi.spyOn(adapter as any, "renderTranslateButton").mockResolvedValue(undefined)
    const initializeSchedulerSpy = vi.spyOn(adapter as any, "initializeScheduler").mockResolvedValue(undefined)
    const tryAutoStartSubtitlesSpy = vi.spyOn(adapter as any, "tryAutoStartSubtitles").mockResolvedValue(undefined)

    adapter.notifyNavigation({ force: true })
    await vi.advanceTimersByTimeAsync(NAVIGATION_HANDLER_DELAY)

    expect(resetForNavigationSpy).toHaveBeenCalledTimes(1)
    expect(renderTranslateButtonSpy).toHaveBeenCalledTimes(1)
    expect(initializeSchedulerSpy).toHaveBeenCalledTimes(1)
    expect(tryAutoStartSubtitlesSpy).toHaveBeenCalledTimes(1)
  })

  it.each([
    {
      name: "resolved fetch",
      settle: (deferred: ReturnType<typeof createDeferred<Array<{ text: string, start: number, end: number }>>>) => {
        deferred.resolve([{ text: "stale", start: 0, end: 1000 }])
      },
    },
    {
      name: "rejected fetch",
      settle: (deferred: ReturnType<typeof createDeferred<Array<{ text: string, start: number, end: number }>>>) => {
        deferred.reject(new Error("stale boom"))
      },
    },
  ])("ignores a stale async $name after navigation invalidates a subtitle start", async ({ settle }) => {
    const deferredFetch = createDeferred<Array<{ text: string, start: number, end: number }>>()
    const { adapter, subtitlesFetcher } = createAdapter([])
    vi.mocked(subtitlesFetcher.fetch).mockReturnValue(deferredFetch.promise)

    attachScheduler(adapter, true)

    const startPromise = (adapter as any).startTranslation()
    await vi.waitFor(() => {
      expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(1)
    })

    adapter.notifyNavigation({ force: true })
    const nextScheduler = attachScheduler(adapter, true)

    settle(deferredFetch)
    await startPromise

    expect(nextScheduler.supplementSubtitles).not.toHaveBeenCalled()
    expect(nextScheduler.setState).not.toHaveBeenCalled()
  })

  it("rebuilds a translated same-track session after subtitles are disabled and re-enabled", async () => {
    const subtitles = [{ text: "translate me", start: 0, end: 1000 }]
    const { adapter, subtitlesFetcher } = createAdapter(subtitles)
    const oldCoordinator = {
      clearFailed: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    const newCoordinator = {
      clearFailed: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    // Constructor mocks cannot be arrows because the adapter instantiates this class with `new`.
    // eslint-disable-next-line prefer-arrow-callback
    mocks.TranslationCoordinator.mockImplementationOnce(function () {
      return newCoordinator
    })
    vi.mocked(subtitlesFetcher.shouldUseSameTrack).mockResolvedValue(true)

    attachScheduler(adapter, true)
    ;(document as any).querySelector = vi.fn(() => null)
    ;(adapter as any).sourceSubtitles = subtitles
    ;(adapter as any).sourceProcessedSubtitles = subtitles
    ;(adapter as any).sourceVideoId = ""
    ;(adapter as any).sessionSubtitles = subtitles
    ;(adapter as any).sessionProcessedFragments = subtitles
    ;(adapter as any).sessionVideoId = ""
    ;(adapter as any).sessionGeneration = (adapter as any).translationGeneration
    ;(adapter as any).translationCoordinator = oldCoordinator

    adapter.toggleSubtitlesManually(false)
    const startPromise = (adapter as any).startTranslation()

    await vi.waitFor(() => {
      expect(mocks.TranslationCoordinator).toHaveBeenCalledTimes(1)
    })
    await startPromise

    expect(oldCoordinator.clearFailed).not.toHaveBeenCalled()
    expect(oldCoordinator.start).not.toHaveBeenCalled()
    expect(newCoordinator.start).toHaveBeenCalledTimes(1)
  })

  it("does not start translated work after subtitles are disabled during translated setup", async () => {
    const deferredTranslatedConfig = createDeferred<any>()
    const { adapter } = createAdapter([{ text: "translate me", start: 0, end: 1000 }])
    mocks.getLocalConfig.mockReturnValueOnce(deferredTranslatedConfig.promise)

    attachScheduler(adapter, true)
    ;(document as any).querySelector = vi.fn(() => null)
    ;(adapter as any).sessionSubtitles = [{ text: "translate me", start: 0, end: 1000 }]
    ;(adapter as any).sourceProcessedSubtitles = [{ text: "translate me", start: 0, end: 1000 }]
    const translationGeneration = (adapter as any).translationGeneration

    const processPromise = (adapter as any).processTranslatedSubtitles(translationGeneration)
    await vi.waitFor(() => {
      expect(mocks.getLocalConfig).toHaveBeenCalledTimes(1)
    })

    adapter.toggleSubtitlesManually(false)
    deferredTranslatedConfig.resolve({
      language: {
        targetCode: "spa",
      },
      providersConfig: [],
      videoSubtitles: {
        aiSegmentation: false,
        providerId: null,
      },
    })
    await processPromise.catch(() => undefined)

    expect(mocks.TranslationCoordinator).not.toHaveBeenCalled()
    expect(mocks.translationCoordinatorStart).not.toHaveBeenCalled()
  })
})
