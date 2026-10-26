import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SUBTITLES_SOURCE } from "@/utils/constants/subtitles"
import {
  NoSubtitlesError,
  OverlaySubtitlesError,
  ToastSubtitlesError,
} from "@/utils/subtitles/errors"
import {
  adPlayingAtom,
  currentTimeMsAtom,
  sourceTrackAtom,
  subtitlesSidebarOpenAtom,
  subtitlesSourceAtom,
  subtitlesStore,
  translatedTrackAtom,
} from "../atoms"
import { wordLookupAtom } from "../learning/atoms"
import { TranslationCoordinator } from "../translation-coordinator"
import { UniversalVideoAdapter } from "../universal-adapter"

const mocks = vi.hoisted(() => ({
  getLocalConfig: vi.fn<(...args: any[]) => any>(),
  buildSubtitlesSummaryContextHash: vi.fn<(...args: any[]) => any>(() => null),
  fetchSubtitlesSummary: vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
  translateSubtitles: vi.fn<(...args: any[]) => any>(),
  resolveSubtitlesProviderRef: vi.fn<(...args: any[]) => any>(),
  showSubtitlesErrorToast: vi.fn<(...args: any[]) => any>(),
  showAiSubtitlesWallToast: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/subtitles/toast", () => ({
  showSubtitlesErrorToast: mocks.showSubtitlesErrorToast,
  showAiSubtitlesWallToast: mocks.showAiSubtitlesWallToast,
}))

vi.mock("@/utils/config/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/config/storage")>()
  return {
    ...actual,
    getLocalConfig: mocks.getLocalConfig,
  }
})

vi.mock("@/utils/subtitles/processor/translator", () => ({
  buildSubtitlesSummaryContextHash: mocks.buildSubtitlesSummaryContextHash,
  resolveSubtitlesProviderRef: mocks.resolveSubtitlesProviderRef,
  fetchSubtitlesSummary: mocks.fetchSubtitlesSummary,
  translateSubtitles: mocks.translateSubtitles,
}))

function createAdapter(fetchResult: Array<{ text: string; start: number; end: number }>) {
  const subtitlesFetcher = {
    fetch: vi.fn<(...args: any[]) => any>().mockResolvedValue(fetchResult),
    cleanup: vi.fn<(...args: any[]) => any>(),
    shouldUseSameTrack: vi.fn<(...args: any[]) => any>().mockResolvedValue(false),
    getSourceLanguage: () => "en",
    hasAvailableSubtitles: vi.fn<(...args: any[]) => any>().mockResolvedValue(true),
  }

  const adapter = new UniversalVideoAdapter({
    config: {
      platform: "youtube",
      selectors: {
        video: "video",
        playerContainer: ".player",
        controlsBar: ".controls",
        nativeSubtitles: ".native-subtitles",
      },
      events: {},
    },
    fetchers: {
      native: () => subtitlesFetcher,
    },
  })

  return { adapter, subtitlesFetcher }
}

function attachScheduler(adapter: UniversalVideoAdapter, active: boolean, currentTime = 0) {
  const subtitlesScheduler = {
    isActive: vi.fn<(...args: any[]) => any>(() => active),
    reset: vi.fn<(...args: any[]) => any>(),
    stop: vi.fn<(...args: any[]) => any>(),
    setState: vi.fn<(...args: any[]) => any>(),
    supplementSubtitles: vi.fn<(...args: any[]) => any>(),
    reconcileTranslatedCuesAfterRecut: vi.fn<(...args: any[]) => any>(),
    resyncFromVideo: vi.fn<(...args: any[]) => any>(),
    getVideoElement: vi.fn<(...args: any[]) => any>(() => ({ currentTime })),
    getState: vi.fn<(...args: any[]) => any>(() => "idle"),
  }

  ;(adapter as any).subtitlesScheduler = subtitlesScheduler
  return subtitlesScheduler
}

describe("universalVideoAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subtitlesStore.set(sourceTrackAtom, [])
    subtitlesStore.set(translatedTrackAtom, [])
    subtitlesStore.set(currentTimeMsAtom, 0)
    subtitlesStore.set(subtitlesSidebarOpenAtom, false)
    vi.stubGlobal("document", {
      title: "Test video",
      querySelector: vi.fn<(...args: any[]) => any>(() => null),
    })
    mocks.getLocalConfig.mockResolvedValue({
      language: {},
      providersConfig: [],
      videoSubtitles: {
        aiSegmentation: false,
        providerId: null,
      },
    })
  })

  afterEach(() => {
    subtitlesStore.set(adPlayingAtom, false)
    vi.unstubAllGlobals()
  })

  it("tracks ad state and resyncs subtitles when an ad ends", () => {
    const { adapter } = createAdapter([])
    const scheduler = attachScheduler(adapter, true)
    const requestTick = vi.fn<(...args: any[]) => any>()
    ;(adapter as any).translationCoordinator = { requestTick }

    let playing = true
    const player = {} as HTMLElement
    vi.stubGlobal("document", {
      title: "Test video",
      querySelector: vi.fn<(selector: string) => Element | null>(() => player),
    })
    ;(adapter as any).config.isAdPlaying = vi.fn<() => boolean>(() => playing)

    let observerCallback!: MutationCallback
    const observe = vi.fn<(...args: any[]) => any>()
    const disconnect = vi.fn<(...args: any[]) => any>()
    class FakeMutationObserver {
      constructor(callback: MutationCallback) {
        observerCallback = callback
      }

      observe = observe
      disconnect = disconnect
    }
    vi.stubGlobal("MutationObserver", FakeMutationObserver)

    ;(adapter as any).setupAdObserver()

    expect(subtitlesStore.get(adPlayingAtom)).toBe(true)
    expect(observe).toHaveBeenCalledWith(player, {
      attributes: true,
      attributeFilter: ["class"],
    })

    playing = false
    observerCallback([], {} as MutationObserver)

    expect(subtitlesStore.get(adPlayingAtom)).toBe(false)
    expect(scheduler.resyncFromVideo).toHaveBeenCalledTimes(1)
    expect(requestTick).toHaveBeenCalledTimes(1)

    playing = true
    observerCallback([], {} as MutationObserver)
    ;(adapter as any).teardownAdObserver()

    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(subtitlesStore.get(adPlayingAtom)).toBe(false)
  })

  describe("a load that overlapped an ad", () => {
    function prepareLoads(adapter: UniversalVideoAdapter) {
      const scheduler = attachScheduler(adapter, true)
      ;(scheduler as any).start = vi.fn<(...args: any[]) => any>()
      ;(scheduler as any).show = vi.fn<(...args: any[]) => any>()
      ;(scheduler as any).hide = vi.fn<(...args: any[]) => any>()
      vi.spyOn(adapter as any, "hideNativeSubtitles").mockImplementation(() => {})
      vi.spyOn(adapter as any, "processTranslatedSubtitles").mockResolvedValue(undefined)
      return scheduler
    }

    function setAdPlaying(adapter: UniversalVideoAdapter, playing: boolean) {
      ;(adapter as any).config.isAdPlaying = () => playing
      ;(adapter as any).observedAdPlayer = {} as HTMLElement
      ;(adapter as any).syncAdPlayingState()
    }

    const lookupFailure = () => new OverlaySubtitlesError("subtitles.errors.fetchSubTimeout")

    it("retries a load that failed during the ad once the ad ends", async () => {
      const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])
      const scheduler = prepareLoads(adapter)
      subtitlesFetcher.fetch.mockRejectedValueOnce(lookupFailure())
      setAdPlaying(adapter, true)

      await (adapter as any).switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE)

      expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(1)
      expect(scheduler.setState).toHaveBeenCalledWith("error", {
        message: "subtitles.errors.fetchSubTimeout",
      })

      setAdPlaying(adapter, false)

      await vi.waitFor(() => expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(2))
      await vi.waitFor(() =>
        expect((adapter as any).processTranslatedSubtitles).toHaveBeenCalledTimes(1),
      )

      // The retry is spent: a later ad break has no failed load left to retry.
      const laterRetry = vi.spyOn(adapter as any, "switchSubtitlesFetcher")
      setAdPlaying(adapter, true)
      setAdPlaying(adapter, false)
      expect(laterRetry).not.toHaveBeenCalled()
    })

    it("retries right away when the ad ended before the load gave up", async () => {
      const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])
      const scheduler = prepareLoads(adapter)
      let failLoad: (error: unknown) => void = () => {}
      subtitlesFetcher.fetch.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            failLoad = reject
          }),
      )
      setAdPlaying(adapter, true)

      const firstLoad = (adapter as any).switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE)
      await vi.waitFor(() => expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(1))
      setAdPlaying(adapter, false)
      failLoad(lookupFailure())
      await firstLoad

      await vi.waitFor(() => expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(2))
      expect(scheduler.setState).not.toHaveBeenCalledWith("error", expect.anything())
    })

    it("does not retry once subtitles were turned off during the ad", async () => {
      const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])
      const scheduler = prepareLoads(adapter)
      subtitlesFetcher.fetch.mockRejectedValueOnce(lookupFailure())
      setAdPlaying(adapter, true)

      await (adapter as any).switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE)
      adapter.toggleSubtitlesManually(false)
      scheduler.isActive.mockReturnValue(false)
      const retry = vi.spyOn(adapter as any, "switchSubtitlesFetcher")
      setAdPlaying(adapter, false)

      expect(retry).not.toHaveBeenCalled()
      expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(1)
    })

    it("leaves a failure that no ad overlapped alone", async () => {
      const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])
      prepareLoads(adapter)
      subtitlesFetcher.fetch.mockRejectedValueOnce(lookupFailure())

      await (adapter as any).switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE)
      const retry = vi.spyOn(adapter as any, "switchSubtitlesFetcher")
      setAdPlaying(adapter, true)
      setAdPlaying(adapter, false)

      expect(retry).not.toHaveBeenCalled()
      expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(1)
    })

    // The captions loaded fine; whatever broke afterwards was not the ad's doing.
    it("does not retry a failure after the captions loaded", async () => {
      const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])
      const scheduler = prepareLoads(adapter)
      vi.mocked((adapter as any).processTranslatedSubtitles).mockRejectedValueOnce(
        new OverlaySubtitlesError("provider rejected"),
      )
      setAdPlaying(adapter, true)

      await (adapter as any).switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE)
      const retry = vi.spyOn(adapter as any, "switchSubtitlesFetcher")
      setAdPlaying(adapter, false)

      expect(retry).not.toHaveBeenCalled()
      expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(1)
      expect(scheduler.setState).toHaveBeenCalledWith("error", { message: "provider rejected" })
    })

    it("keeps the current load's retry when an older load fails after it", async () => {
      const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])
      prepareLoads(adapter)
      let failOlderLoad: (error: unknown) => void = () => {}
      subtitlesFetcher.fetch
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              failOlderLoad = reject
            }),
        )
        .mockRejectedValueOnce(lookupFailure())
      setAdPlaying(adapter, true)

      const olderLoad = (adapter as any).switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE)
      await vi.waitFor(() => expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(1))
      await (adapter as any).switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE)
      failOlderLoad(lookupFailure())
      await olderLoad
      setAdPlaying(adapter, false)

      await vi.waitFor(() => expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(3))
    })
  })

  it("shows a failed player lookup as itself rather than as a video without subtitles", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])
    subtitlesFetcher.hasAvailableSubtitles.mockRejectedValue(
      new OverlaySubtitlesError("subtitles.errors.fetchSubTimeout"),
    )
    const scheduler = attachScheduler(adapter, true)

    await expect((adapter as any).startTranslation()).resolves.toBe(false)

    expect(subtitlesFetcher.fetch).not.toHaveBeenCalled()
    expect(scheduler.setState).toHaveBeenLastCalledWith("error", {
      message: "subtitles.errors.fetchSubTimeout",
    })
  })

  it("treats a lookup that failed after the video changed as superseded", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])
    let videoId = "first"
    ;(adapter as any).config.getVideoId = () => videoId
    subtitlesFetcher.hasAvailableSubtitles.mockImplementation(async () => {
      videoId = "second"
      throw new OverlaySubtitlesError("subtitles.errors.fetchSubTimeout")
    })

    await expect((adapter as any).getOrLoadSourceSubtitles()).rejects.toMatchObject({
      name: "AbortError",
    })
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
    const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])

    const subtitlesScheduler = attachScheduler(adapter, true)

    const clearRuntimeSessionSpy = vi.spyOn(adapter as any, "clearRuntimeSession")
    const clearSourceCacheSpy = vi.spyOn(adapter as any, "clearSourceCache")
    const startTranslationSpy = vi
      .spyOn(adapter as any, "startTranslation")
      .mockResolvedValue(undefined)

    await adapter.handleSourceTrackChanged()

    expect(subtitlesFetcher.shouldUseSameTrack).toHaveBeenCalledTimes(1)
    expect(clearRuntimeSessionSpy).toHaveBeenCalledTimes(1)
    expect(clearSourceCacheSpy).toHaveBeenCalledTimes(1)
    expect(subtitlesFetcher.cleanup).toHaveBeenCalledTimes(1)
    expect(subtitlesScheduler.reset).toHaveBeenCalledTimes(1)
    expect(subtitlesScheduler.setState).toHaveBeenCalledWith("loading")
    expect(startTranslationSpy).toHaveBeenCalledTimes(1)
  })

  it("ignores source track changes when translation is disabled", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])

    attachScheduler(adapter, false)
    const startTranslationSpy = vi
      .spyOn(adapter as any, "startTranslation")
      .mockResolvedValue(undefined)

    await adapter.handleSourceTrackChanged()

    expect(subtitlesFetcher.shouldUseSameTrack).not.toHaveBeenCalled()
    expect(startTranslationSpy).not.toHaveBeenCalled()
  })

  it("does not reload subtitles when the selected track is unchanged", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])

    const subtitlesScheduler = attachScheduler(adapter, true)
    vi.mocked(subtitlesFetcher.shouldUseSameTrack).mockResolvedValue(true)

    const startTranslationSpy = vi
      .spyOn(adapter as any, "startTranslation")
      .mockResolvedValue(undefined)

    await adapter.handleSourceTrackChanged()

    expect(subtitlesFetcher.shouldUseSameTrack).toHaveBeenCalledTimes(1)
    expect(subtitlesFetcher.cleanup).not.toHaveBeenCalled()
    expect(subtitlesScheduler.reset).not.toHaveBeenCalled()
    expect(subtitlesScheduler.setState).not.toHaveBeenCalled()
    expect(startTranslationSpy).not.toHaveBeenCalled()
  })

  it("delegates translated subtitle downloads to the downloader", async () => {
    const { adapter } = createAdapter([])
    const downloader = {
      download: vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
      dispose: vi.fn<(...args: any[]) => any>(),
    }
    ;(adapter as any).translatedSubtitlesDownloader = downloader

    await adapter.downloadTranslatedSubtitles()

    expect(downloader.download).toHaveBeenCalledTimes(1)
  })

  it("returns false from startTranslation when the fetcher fails", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([{ text: "x", start: 0, end: 1 }])
    subtitlesFetcher.fetch.mockRejectedValue(new Error("boom"))
    attachScheduler(adapter, true)

    await expect((adapter as any).startTranslation()).resolves.toBe(false)
  })

  // Netflix answers the track check with a round trip to the page, which can take seconds.
  it("starts a fresh load without waiting on the fetcher's track check", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([{ text: "x", start: 0, end: 1 }])
    subtitlesFetcher.shouldUseSameTrack.mockReturnValue(new Promise(() => {}))
    subtitlesFetcher.fetch.mockRejectedValue(new Error("boom"))
    attachScheduler(adapter, true)

    void (adapter as any).startTranslation()

    await vi.waitFor(() => expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(1))
  })

  // The loading state has no auto-hide of its own, so a wall that only raises a
  // toast used to leave "Loading AI subtitles" pinned to the player forever.
  it("clears the loading state and anchors the AI wall to its trigger", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([])
    const action = { label: "action.upgrade", url: "https://readfrog.app/pricing" }
    ;(adapter as any).source = SUBTITLES_SOURCE.AI
    subtitlesFetcher.fetch.mockRejectedValue(
      new ToastSubtitlesError("subtitles.errors.aiSubscriptionRequired", action),
    )
    const scheduler = attachScheduler(adapter, true)

    await expect((adapter as any).startTranslation()).resolves.toBe(false)

    expect(scheduler.setState).toHaveBeenLastCalledWith("idle")
    expect(mocks.showAiSubtitlesWallToast).toHaveBeenCalledWith(
      "subtitles.errors.aiSubscriptionRequired",
      action,
    )
  })

  it("raises a toast without an action when the error carries none", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([])
    ;(adapter as any).source = SUBTITLES_SOURCE.AI
    subtitlesFetcher.fetch.mockRejectedValue(
      new ToastSubtitlesError("subtitles.errors.aiVideoTooLong"),
    )
    attachScheduler(adapter, true)

    await expect((adapter as any).startTranslation()).resolves.toBe(false)

    expect(mocks.showAiSubtitlesWallToast).toHaveBeenCalledWith(
      "subtitles.errors.aiVideoTooLong",
      undefined,
    )
  })

  // Only the AI request has a control on screen to point at. Anything else has
  // nothing on the player that would explain a toast pinned to that button.
  it("leaves a non-AI toast error docked in the page corner", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([])
    subtitlesFetcher.fetch.mockRejectedValue(
      new ToastSubtitlesError("subtitles.errors.noSubtitlesFound"),
    )
    attachScheduler(adapter, true)

    await expect((adapter as any).startTranslation()).resolves.toBe(false)

    expect(mocks.showSubtitlesErrorToast).toHaveBeenCalledWith(
      "subtitles.errors.noSubtitlesFound",
      undefined,
    )
    expect(mocks.showAiSubtitlesWallToast).not.toHaveBeenCalled()
  })

  // A superseded switch or a navigation rejects with DOMException("Aborted"),
  // whose message is not user copy and must never be painted on the player.
  it("stays silent when the run was aborted", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([])
    subtitlesFetcher.fetch.mockRejectedValue(new DOMException("Aborted", "AbortError"))
    const scheduler = attachScheduler(adapter, true)

    await expect((adapter as any).startTranslation()).resolves.toBe(false)

    expect(mocks.showSubtitlesErrorToast).not.toHaveBeenCalled()
    expect(mocks.showAiSubtitlesWallToast).not.toHaveBeenCalled()
    expect(scheduler.setState).not.toHaveBeenCalledWith("error", expect.anything())
  })

  // The overlay path already replaces the loading state and auto-hides itself;
  // resetting it here would wipe the message the user needs to read.
  it("keeps rendering overlay errors on the player instead of toasting them", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([])
    subtitlesFetcher.fetch.mockRejectedValue(
      new OverlaySubtitlesError("subtitles.errors.aiRequestFailed"),
    )
    const scheduler = attachScheduler(adapter, true)

    await expect((adapter as any).startTranslation()).resolves.toBe(false)

    expect(scheduler.setState).toHaveBeenLastCalledWith("error", {
      message: "subtitles.errors.aiRequestFailed",
    })
    expect(mocks.showSubtitlesErrorToast).not.toHaveBeenCalled()
    expect(mocks.showAiSubtitlesWallToast).not.toHaveBeenCalled()
  })

  it("refuses AI subtitles for live content with a toast before switching fetchers", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([])
    ;(adapter as any).config.isLiveContent = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
    const switchSubtitlesFetcher = vi
      .spyOn(adapter as any, "switchSubtitlesFetcher")
      .mockResolvedValue(undefined)

    await adapter.requestAiSubtitles()

    expect(mocks.showAiSubtitlesWallToast).toHaveBeenCalledWith(
      "subtitles.errors.aiLiveReplayUnsupported",
    )
    expect(switchSubtitlesFetcher).not.toHaveBeenCalled()
    expect(subtitlesFetcher.cleanup).not.toHaveBeenCalled()
  })

  it("switches to the AI fetcher when the video is not live content", async () => {
    const { adapter } = createAdapter([])
    ;(adapter as any).config.isLiveContent = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(false)
    const switchSubtitlesFetcher = vi
      .spyOn(adapter as any, "switchSubtitlesFetcher")
      .mockResolvedValue(undefined)

    await adapter.requestAiSubtitles()

    expect(switchSubtitlesFetcher).toHaveBeenCalledWith(SUBTITLES_SOURCE.AI)
    expect(mocks.showAiSubtitlesWallToast).not.toHaveBeenCalled()
  })

  it("switches to the AI fetcher when the platform cannot tell live content apart", async () => {
    const { adapter } = createAdapter([])
    const switchSubtitlesFetcher = vi
      .spyOn(adapter as any, "switchSubtitlesFetcher")
      .mockResolvedValue(undefined)

    await adapter.requestAiSubtitles()

    expect(switchSubtitlesFetcher).toHaveBeenCalledWith(SUBTITLES_SOURCE.AI)
    expect(mocks.showAiSubtitlesWallToast).not.toHaveBeenCalled()
  })

  it("reverts the source back to native so a failed AI switch can be retried", () => {
    const { adapter, subtitlesFetcher } = createAdapter([])
    const aiFetcher = { cleanup: vi.fn<(...args: any[]) => any>() }
    ;(adapter as any).fetcher = aiFetcher
    ;(adapter as any).source = SUBTITLES_SOURCE.AI
    subtitlesStore.set(subtitlesSourceAtom, SUBTITLES_SOURCE.AI)

    ;(adapter as any).revertToNativeSource()

    expect(aiFetcher.cleanup).toHaveBeenCalledTimes(1)
    expect((adapter as any).source).toBe(SUBTITLES_SOURCE.NATIVE)
    expect(subtitlesStore.get(subtitlesSourceAtom)).toBe(SUBTITLES_SOURCE.NATIVE)
    expect((adapter as any).fetcher).toBe(subtitlesFetcher)
  })

  it("does not revert to native when a newer switch supersedes the in-flight one", async () => {
    const { adapter } = createAdapter([])
    const aiFetcher = { cleanup: vi.fn<(...args: any[]) => any>() }
    ;(adapter as any).fetchers = {
      native: (adapter as any).fetchers.native,
      ai: () => aiFetcher,
    }
    const scheduler = attachScheduler(adapter, true)
    ;(scheduler as any).start = vi.fn<(...args: any[]) => any>()
    ;(scheduler as any).show = vi.fn<(...args: any[]) => any>()
    vi.spyOn(adapter as any, "hideNativeSubtitles").mockImplementation(() => {})
    vi.spyOn(adapter as any, "showNativeSubtitles").mockImplementation(() => {})

    let resolveStart: (value: boolean) => void = () => {}
    vi.spyOn(adapter as any, "startTranslation").mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveStart = resolve
        }),
    )
    const revertSpy = vi.spyOn(adapter as any, "revertToNativeSource").mockImplementation(() => {})

    const pending = (adapter as any).switchSubtitlesFetcher(SUBTITLES_SOURCE.AI)
    ;(adapter as any).resetForNavigation()
    resolveStart(false)
    await pending

    expect(revertSpy).not.toHaveBeenCalled()
  })

  it("closes an open word lookup when subtitles are turned off by shortcut", () => {
    const { adapter } = createAdapter([])
    subtitlesStore.set(wordLookupAtom, { cueStart: 0, index: 0 })

    adapter.toggleSubtitlesByShortcut(false)

    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
  })

  it("disposes translated subtitle download state when navigation starts", () => {
    const { adapter } = createAdapter([])
    const downloader = {
      download: vi.fn<(...args: any[]) => any>(),
      dispose: vi.fn<(...args: any[]) => any>(),
    }
    ;(adapter as any).translatedSubtitlesDownloader = downloader
    attachScheduler(adapter, false)

    ;(adapter as any).clearVisibleStateForNavigation()

    expect(downloader.dispose).toHaveBeenCalledTimes(1)
  })

  it("publishes source track without seeding untranslated cues into the scheduler", async () => {
    const subtitles = [
      { text: "I agree.", start: 0, end: 500 },
      { text: "It is true.", start: 500, end: 1000 },
    ]
    const { adapter } = createAdapter(subtitles)
    const subtitlesScheduler = attachScheduler(adapter, true)

    mocks.getLocalConfig.mockResolvedValue({
      language: { targetCode: "zh-CN" },
      providersConfig: [],
      videoSubtitles: {
        aiSegmentation: false,
        providerId: null,
      },
    })

    await (adapter as any).getOrLoadSourceSubtitles()
    ;(adapter as any).sessionSubtitles = (adapter as any).sourceSubtitles

    const startSpy = vi
      .spyOn(TranslationCoordinator.prototype, "start")
      .mockImplementation(() => undefined)

    await (adapter as any).processTranslatedSubtitles()

    const sourceTrack = subtitlesStore.get(sourceTrackAtom)
    expect(sourceTrack.length).toBeGreaterThan(0)
    expect(sourceTrack.every((f) => f.translation === undefined)).toBe(true)

    // Scheduler must not receive untranslated seeds; only coordinator will push translations later.
    expect(subtitlesScheduler.supplementSubtitles).not.toHaveBeenCalled()
    expect(startSpy).toHaveBeenCalled()

    startSpy.mockRestore()
  })

  it("publishes the source track without waiting on the provider resolve", async () => {
    const { adapter } = createAdapter([{ text: "hello", start: 0, end: 1000 }])
    attachScheduler(adapter, true)

    await (adapter as any).getOrLoadSourceSubtitles()
    ;(adapter as any).sessionSubtitles = (adapter as any).sourceSubtitles

    const startSpy = vi
      .spyOn(TranslationCoordinator.prototype, "start")
      .mockImplementation(() => undefined)

    // A hosted resolve reaches the network, and backgroundFetch carries no
    // timeout — so a dead connection never settles this. The original captions
    // need nothing from it, and this is the only path that puts captions on
    // screen for the translated flow: ordering it after the resolve left the
    // player in "loading" showing nothing at all.
    // Once, not permanently: clearAllMocks between tests drops calls but keeps
    // implementations, so a never-settling mockReturnValue would hang the next
    // test instead of this one.
    mocks.resolveSubtitlesProviderRef.mockReturnValueOnce(new Promise(() => {}))

    void (adapter as any).processTranslatedSubtitles()
    await Promise.resolve()
    await Promise.resolve()

    expect(subtitlesStore.get(sourceTrackAtom).length).toBeGreaterThan(0)

    startSpy.mockRestore()
  })

  it("syncs currentTimeMsAtom from the video when publishing the source track", async () => {
    const { adapter } = createAdapter([{ text: "hello", start: 0, end: 1000 }])
    attachScheduler(adapter, true, 42.5)

    await (adapter as any).getOrLoadSourceSubtitles()
    ;(adapter as any).sessionSubtitles = (adapter as any).sourceSubtitles

    const startSpy = vi
      .spyOn(TranslationCoordinator.prototype, "start")
      .mockImplementation(() => undefined)

    await (adapter as any).processTranslatedSubtitles()

    expect(subtitlesStore.get(currentTimeMsAtom)).toBe(42_500)

    startSpy.mockRestore()
  })

  it("drops stale translations when an inactive track is refreshed", async () => {
    const { adapter } = createAdapter([{ text: "hello", start: 0, end: 500 }])
    attachScheduler(adapter, false)
    subtitlesStore.set(sourceTrackAtom, [{ text: "old", start: 0, end: 500 }])
    subtitlesStore.set(translatedTrackAtom, [
      { text: "old", start: 0, end: 500, translation: "旧" },
    ])

    await adapter.handleSourceTrackChanged()

    expect(subtitlesStore.get(translatedTrackAtom)).toEqual([])
  })

  it("resets the hidden session when an inactive track is refreshed", async () => {
    const { adapter } = createAdapter([{ text: "hello", start: 0, end: 500 }])
    const subtitlesScheduler = attachScheduler(adapter, false)
    subtitlesStore.set(sourceTrackAtom, [{ text: "old", start: 0, end: 500 }])
    ;(adapter as any).sessionProcessedFragments = [
      { text: "old", start: 0, end: 500, translation: "旧" },
    ]
    ;(adapter as any).sessionVideoId = ""

    await adapter.handleSourceTrackChanged()

    // Otherwise re-enabling captions would resume the old cues against the new track.
    expect((adapter as any).sessionProcessedFragments).toEqual([])
    expect((adapter as any).sessionVideoId).toBeNull()
    expect(subtitlesScheduler.reset).toHaveBeenCalledTimes(1)
    expect(subtitlesStore.get(sourceTrackAtom).map((cue) => cue.text)).toEqual(["hello"])
  })

  it("refreshes the track while the transcript's first load is still in flight", async () => {
    const { adapter, subtitlesFetcher } = createAdapter([{ text: "hello", start: 0, end: 500 }])
    attachScheduler(adapter, false)
    let resolveFirstFetch!: (cues: unknown) => void
    subtitlesFetcher.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirstFetch = resolve
      }),
    )

    const firstLoad = adapter.ensureSourceTrackPublished()
    await vi.waitFor(() => expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(1))

    await adapter.handleSourceTrackChanged()

    // An empty atom used to read as "transcript not in use", dropping the change.
    expect(subtitlesFetcher.cleanup).toHaveBeenCalledTimes(1)
    expect(subtitlesFetcher.fetch).toHaveBeenCalledTimes(2)

    resolveFirstFetch([{ text: "old", start: 0, end: 500 }])
    await firstLoad.catch(() => undefined)

    expect(subtitlesStore.get(sourceTrackAtom).map((cue) => cue.text)).toEqual(["hello"])
  })

  it("auto-starts subtitles for a video that arrives with the learning panel open", async () => {
    const { adapter } = createAdapter([{ text: "hello", start: 0, end: 500 }])
    attachScheduler(adapter, false)
    mocks.getLocalConfig.mockResolvedValue({
      videoSubtitles: { autoStart: { youtube: false, xcom: false, netflix: false } },
    })
    const toggleSpy = vi
      .spyOn(adapter as any, "toggleSubtitlesWithSource")
      .mockImplementation(() => undefined)
    subtitlesStore.set(subtitlesSidebarOpenAtom, true)

    await (adapter as any).tryAutoStartSubtitles()

    expect(toggleSpy).toHaveBeenCalledExactlyOnceWith(true, "auto")
  })

  it("auto-starts subtitles when this platform's switch is on", async () => {
    const { adapter } = createAdapter([{ text: "hello", start: 0, end: 500 }])
    attachScheduler(adapter, false)
    mocks.getLocalConfig.mockResolvedValue({
      videoSubtitles: { autoStart: { youtube: true, xcom: false, netflix: false } },
    })
    const toggleSpy = vi
      .spyOn(adapter as any, "toggleSubtitlesWithSource")
      .mockImplementation(() => undefined)

    await (adapter as any).tryAutoStartSubtitles()

    expect(toggleSpy).toHaveBeenCalledExactlyOnceWith(true, "auto")
  })

  it("ignores the switches of other platforms", async () => {
    const { adapter } = createAdapter([{ text: "hello", start: 0, end: 500 }])
    attachScheduler(adapter, false)
    mocks.getLocalConfig.mockResolvedValue({
      videoSubtitles: { autoStart: { youtube: false, xcom: true, netflix: true } },
    })
    const toggleSpy = vi
      .spyOn(adapter as any, "toggleSubtitlesWithSource")
      .mockImplementation(() => undefined)

    await (adapter as any).tryAutoStartSubtitles()

    expect(toggleSpy).not.toHaveBeenCalled()
  })

  it("leaves subtitles off when neither autoStart nor the learning panel asks", async () => {
    const { adapter } = createAdapter([{ text: "hello", start: 0, end: 500 }])
    attachScheduler(adapter, false)
    mocks.getLocalConfig.mockResolvedValue({
      videoSubtitles: { autoStart: { youtube: false, xcom: false, netflix: false } },
    })
    const toggleSpy = vi
      .spyOn(adapter as any, "toggleSubtitlesWithSource")
      .mockImplementation(() => undefined)

    await (adapter as any).tryAutoStartSubtitles()

    expect(toggleSpy).not.toHaveBeenCalled()
  })

  describe("auto-start on X", () => {
    function setUpVideoWithoutSubtitles() {
      const { adapter, subtitlesFetcher } = createAdapter([])
      ;(adapter as any).config.platform = "xcom"
      // X hides its own captions through the text tracks, not a selector.
      delete (adapter as any).config.selectors.nativeSubtitles
      subtitlesFetcher.hasAvailableSubtitles.mockResolvedValue(false)
      let active = false
      const scheduler = {
        ...attachScheduler(adapter, false),
        isActive: vi.fn<() => boolean>(() => active),
        start: vi.fn<(...args: any[]) => any>(),
        show: vi.fn<(...args: any[]) => any>(() => {
          active = true
        }),
        hide: vi.fn<(...args: any[]) => any>(() => {
          active = false
        }),
      }
      ;(adapter as any).subtitlesScheduler = scheduler
      return { adapter, scheduler }
    }

    it("turns back off without a word when the video has no subtitles", async () => {
      const { adapter, scheduler } = setUpVideoWithoutSubtitles()

      await (adapter as any).switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE, { quiet: true })

      expect(scheduler.setState).not.toHaveBeenCalledWith("loading", expect.anything())
      expect(scheduler.setState).not.toHaveBeenCalledWith("error", expect.anything())
      expect(scheduler.isActive()).toBe(false)
    })

    it("only goes quiet for an automatic start", () => {
      const { adapter } = setUpVideoWithoutSubtitles()
      const switchSpy = vi
        .spyOn(adapter as any, "switchSubtitlesFetcher")
        .mockResolvedValue(undefined)

      ;(adapter as any).toggleSubtitlesWithSource(true, "auto")
      adapter.toggleSubtitlesManually(true)

      expect(switchSpy.mock.calls.map((call) => (call[1] as any).quiet)).toEqual([true, false])
    })

    it("still tells a reader who asked that the video has none", async () => {
      const { adapter, scheduler } = setUpVideoWithoutSubtitles()

      await (adapter as any).switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE)

      expect(scheduler.setState).toHaveBeenCalledWith("error", {
        message: new NoSubtitlesError().message,
      })
      expect(scheduler.isActive()).toBe(true)
    })
  })

  it("replaceSourceTrackWindow drops cues that overlap the window by interval", () => {
    const { adapter } = createAdapter([])
    attachScheduler(adapter, true)

    // Spans into the replace window even though its start is before windowStart.
    subtitlesStore.set(sourceTrackAtom, [
      { text: "overlap", start: 0, end: 1500 },
      { text: "after", start: 2000, end: 3000 },
    ])

    ;(adapter as any).replaceSourceTrackWindow(1000, 2000, [
      { text: "recut", start: 1000, end: 2000 },
    ])

    expect(subtitlesStore.get(sourceTrackAtom)).toEqual([
      { text: "recut", start: 1000, end: 2000 },
      { text: "after", start: 2000, end: 3000 },
    ])
  })
})
