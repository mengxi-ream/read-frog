import { beforeEach, describe, expect, it, vi } from "vitest"
import { SUBTITLES_SOURCE } from "@/utils/constants/subtitles"
import { subtitlesSourceAtom, subtitlesStore } from "../atoms"
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

function attachScheduler(adapter: UniversalVideoAdapter, active: boolean) {
  const subtitlesScheduler = {
    isActive: vi.fn<(...args: any[]) => any>(() => active),
    reset: vi.fn<(...args: any[]) => any>(),
    stop: vi.fn<(...args: any[]) => any>(),
    setState: vi.fn<(...args: any[]) => any>(),
  }

  ;(adapter as any).subtitlesScheduler = subtitlesScheduler
  return subtitlesScheduler
}

describe("universalVideoAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("document", { title: "Test video" })
    mocks.getLocalConfig.mockResolvedValue({
      language: {},
      providersConfig: [],
      videoSubtitles: {
        aiSegmentation: false,
        providerId: null,
      },
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
})
