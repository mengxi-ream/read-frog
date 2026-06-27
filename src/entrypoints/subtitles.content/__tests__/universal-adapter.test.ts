import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UniversalVideoAdapter } from "../universal-adapter"

const mocks = vi.hoisted(() => ({
  getLocalConfig: vi.fn(),
  fetchSubtitlesSummary: vi.fn(),
  translateSubtitles: vi.fn(),
}))

vi.mock("@/utils/config/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/config/storage")>()
  return {
    ...actual,
    getLocalConfig: mocks.getLocalConfig,
  }
})

vi.mock("@/utils/subtitles/processor/translator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/subtitles/processor/translator")>()
  return {
    ...actual,
    fetchSubtitlesSummary: mocks.fetchSubtitlesSummary,
    translateSubtitles: mocks.translateSubtitles,
  }
})

function createAdapter(fetchResult: SubtitlesFragment[], preSegmented = false, fetcherOverrides: Record<string, unknown> = {}) {
  const subtitlesFetcher = {
    fetch: vi.fn().mockResolvedValue(fetchResult),
    cleanup: vi.fn(),
    shouldUseSameTrack: vi.fn().mockResolvedValue(false),
    getSourceLanguage: () => "en",
    hasAvailableSubtitles: vi.fn().mockResolvedValue(true),
    isPreSegmented: () => preSegmented,
    ...fetcherOverrides,
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

function attachScheduler(adapter: UniversalVideoAdapter, active: boolean) {
  const video = {
    currentTime: 10,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLVideoElement
  const subtitlesScheduler = {
    isActive: vi.fn(() => active),
    getVideoElement: vi.fn(() => video),
    getState: vi.fn(() => "idle"),
    reset: vi.fn(),
    stop: vi.fn(),
    setState: vi.fn(),
    supplementSubtitles: vi.fn(),
  }

  ;(adapter as any).subtitlesScheduler = subtitlesScheduler
  return subtitlesScheduler
}

describe("universalVideoAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("document", {
      title: "Test video",
      querySelector: vi.fn(() => null),
    })
    mocks.fetchSubtitlesSummary.mockResolvedValue(null)
    mocks.translateSubtitles.mockReturnValue(new Promise(() => {}))
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
    const { adapter, subtitlesFetcher } = createAdapter([
      { text: "hello", start: 0, end: 500 },
    ])

    const subtitlesScheduler = attachScheduler(adapter, true)

    const clearRuntimeSessionSpy = vi.spyOn(adapter as any, "clearRuntimeSession")
    const clearSourceCacheSpy = vi.spyOn(adapter as any, "clearSourceCache")
    const startTranslationSpy = vi.spyOn(adapter as any, "startTranslation").mockResolvedValue(undefined)

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
    const { adapter, subtitlesFetcher } = createAdapter([
      { text: "hello", start: 0, end: 500 },
    ])

    attachScheduler(adapter, false)
    const startTranslationSpy = vi.spyOn(adapter as any, "startTranslation").mockResolvedValue(undefined)

    await adapter.handleSourceTrackChanged()

    expect(subtitlesFetcher.shouldUseSameTrack).not.toHaveBeenCalled()
    expect(startTranslationSpy).not.toHaveBeenCalled()
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

  it("uses official translated subtitles without starting machine translation", async () => {
    const subtitles = [
      { text: "Hello", translation: "你好", start: 0, end: 1000 },
    ]
    const { adapter } = createAdapter(subtitles, true)
    const subtitlesScheduler = attachScheduler(adapter, true)
    const processTranslatedSubtitlesSpy = vi.spyOn(adapter as any, "processTranslatedSubtitles")

    await (adapter as any).startTranslation()

    expect(subtitlesScheduler.supplementSubtitles).toHaveBeenCalledWith(subtitles)
    expect(subtitlesScheduler.setState).toHaveBeenCalledWith("idle")
    expect(processTranslatedSubtitlesSpy).not.toHaveBeenCalled()
  })

  it("renders source subtitles immediately while machine translation is pending", async () => {
    const subtitles = [
      { text: "Pending line", start: 10_000, end: 16_000 },
    ]
    const { adapter } = createAdapter(subtitles)
    const subtitlesScheduler = attachScheduler(adapter, true)
    ;(adapter as any).sourceProcessedSubtitles = subtitles
    ;(adapter as any).sessionSubtitles = subtitles

    await (adapter as any).processTranslatedSubtitles()

    expect(subtitlesScheduler.supplementSubtitles).toHaveBeenCalledWith([
      { text: "Pending line", translation: "", start: 10_000, end: 16_000 },
    ])
  })

  it("forwards live subtitle timing updates for already rendered native cues", () => {
    const liveSubtitles = {
      emit: null as ((subtitles: SubtitlesFragment[]) => void) | null,
    }
    const { adapter } = createAdapter([], false, {
      watchLiveSubtitles: vi.fn((callback: (subtitles: SubtitlesFragment[]) => void) => {
        liveSubtitles.emit = callback
        return vi.fn()
      }),
    })
    const subtitlesScheduler = attachScheduler(adapter, true)
    ;(adapter as any).sourceSubtitles = [
      { text: "First", start: 10_000, end: 16_000 },
    ]
    ;(adapter as any).sessionSubtitles = [
      { text: "First", start: 10_000, end: 16_000 },
    ]
    ;(adapter as any).sourceProcessedSubtitles = [
      { text: "First", translation: "第一句", start: 10_000, end: 16_000 },
    ]
    ;(adapter as any).sessionProcessedFragments = [
      { text: "First", translation: "第一句", start: 10_000, end: 16_000 },
    ]

    ;(adapter as any).startLiveSubtitles()
    expect(liveSubtitles.emit).toBeTypeOf("function")
    const emitLiveSubtitles = liveSubtitles.emit!
    emitLiveSubtitles([
      { text: "First", start: 10_000, end: 11_700 },
      { text: "Second", start: 11_700, end: 18_000 },
    ])

    expect(subtitlesScheduler.supplementSubtitles).toHaveBeenNthCalledWith(1, [
      { text: "First", translation: "第一句", start: 10_000, end: 11_700 },
    ])
    expect(subtitlesScheduler.supplementSubtitles).toHaveBeenNthCalledWith(2, [
      { text: "Second", translation: "Second", start: 11_700, end: 18_000 },
    ])
  })

  it("disposes translated subtitle download state when navigation starts", () => {
    const { adapter } = createAdapter([])
    const downloader = {
      download: vi.fn(),
      dispose: vi.fn(),
    }
    ;(adapter as any).translatedSubtitlesDownloader = downloader
    attachScheduler(adapter, false)

    ;(adapter as any).clearVisibleStateForNavigation()

    expect(downloader.dispose).toHaveBeenCalledTimes(1)
  })
})
