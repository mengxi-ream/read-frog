import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UniversalVideoAdapter } from "../universal-adapter"

const mocks = vi.hoisted(() => ({
  aiSegmentBlock: vi.fn(),
  downloadSubtitlesAsSrt: vi.fn(),
  getLocalConfig: vi.fn(),
  translateSubtitles: vi.fn(),
  fetchSubtitlesSummary: vi.fn(),
}))

vi.mock("@/utils/subtitles/srt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/subtitles/srt")>()
  return {
    ...actual,
    downloadSubtitlesAsSrt: mocks.downloadSubtitlesAsSrt,
  }
})

vi.mock("@/utils/subtitles/processor/translator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/subtitles/processor/translator")>()
  return {
    ...actual,
    translateSubtitles: mocks.translateSubtitles,
    fetchSubtitlesSummary: mocks.fetchSubtitlesSummary,
  }
})

vi.mock("@/utils/config/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/config/storage")>()
  return {
    ...actual,
    getLocalConfig: mocks.getLocalConfig,
  }
})

vi.mock("@/utils/subtitles/processor/ai-segmentation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/subtitles/processor/ai-segmentation")>()
  return {
    ...actual,
    aiSegmentBlock: mocks.aiSegmentBlock,
  }
})

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

function attachScheduler(adapter: UniversalVideoAdapter, active: boolean) {
  const subtitlesScheduler = {
    isActive: vi.fn(() => active),
    reset: vi.fn(),
    setState: vi.fn(),
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
    mocks.fetchSubtitlesSummary.mockResolvedValue(null)
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

  it("downloads a complete translated subtitle SRT", async () => {
    const { adapter } = createAdapter([
      { text: "Hello.", start: 0, end: 1000 },
      { text: "World.", start: 1000, end: 2000 },
    ])
    mocks.translateSubtitles.mockImplementation(async (fragments: SubtitlesFragment[]) =>
      fragments.map(fragment => ({
        ...fragment,
        translation: `zh:${fragment.text}`,
      })),
    )

    await adapter.downloadTranslatedSubtitles()

    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith({
      subtitles: [
        { text: "zh:Hello. World.", start: 0, end: 2000 },
      ],
      pageTitle: "Test video",
      videoId: undefined,
      suffix: "translated",
    })
  })

  it("reports translated export progress after each translation batch", async () => {
    const { adapter } = createAdapter([
      { text: "Hello.", start: 0, end: 1000 },
    ])
    const fragments = Array.from({ length: 11 }, (_, index) => ({
      text: `Line ${index + 1}.`,
      start: index * 1000,
      end: (index + 1) * 1000,
    }))
    vi.spyOn(adapter as any, "buildExportProcessedSubtitles").mockResolvedValue(fragments)
    mocks.translateSubtitles.mockImplementation(async (batch: SubtitlesFragment[]) =>
      batch.map(fragment => ({
        ...fragment,
        translation: `zh:${fragment.text}`,
      })),
    )
    const onProgress = vi.fn()

    await adapter.downloadTranslatedSubtitles({ onProgress })

    expect(onProgress).toHaveBeenNthCalledWith(1, { phase: "preparing", progress: 0 })
    expect(onProgress).toHaveBeenNthCalledWith(2, { phase: "preparing", progress: 30 })
    expect(onProgress).toHaveBeenNthCalledWith(3, { phase: "translating", progress: 62 })
    expect(onProgress).toHaveBeenNthCalledWith(4, { phase: "translating", progress: 94 })
    expect(onProgress).toHaveBeenNthCalledWith(5, { phase: "translating", progress: 100 })
  })

  it("reports preparation progress while AI segmentation runs during export", async () => {
    const { adapter } = createAdapter([
      { text: "A", start: 0, end: 10000 },
      { text: "B", start: 10000, end: 20000 },
      { text: "C", start: 20000, end: 30000 },
      { text: "D", start: 30000, end: 40000 },
      { text: "E", start: 40000, end: 50000 },
      { text: "F", start: 50000, end: 55000 },
    ])
    mocks.getLocalConfig.mockResolvedValue({
      language: {},
      providersConfig: [],
      videoSubtitles: {
        aiSegmentation: true,
        providerId: "test-provider",
      },
    })
    mocks.aiSegmentBlock.mockImplementation(async (chunk: SubtitlesFragment[]) => chunk)
    mocks.translateSubtitles.mockImplementation(async (fragments: SubtitlesFragment[]) =>
      fragments.map(fragment => ({
        ...fragment,
        translation: `zh:${fragment.text}`,
      })),
    )
    const onProgress = vi.fn()

    await adapter.downloadTranslatedSubtitles({ onProgress })

    expect(onProgress.mock.calls.some(([update]) => update.phase === "preparing" && update.progress > 0)).toBe(true)
    expect(onProgress.mock.calls.at(-1)).toEqual([{ phase: "translating", progress: 100 }])
  })

  it("aborts translated export when the signal is aborted", async () => {
    const { adapter } = createAdapter([
      { text: "Hello.", start: 0, end: 1000 },
    ])
    const abortController = new AbortController()
    abortController.abort()

    await expect(adapter.downloadTranslatedSubtitles({ signal: abortController.signal }))
      .rejects
      .toMatchObject({ name: "AbortError" })

    expect(mocks.downloadSubtitlesAsSrt).not.toHaveBeenCalled()
  })

  it("does not download when any translated subtitle line is missing", async () => {
    const { adapter } = createAdapter([
      { text: "Hello.", start: 0, end: 1000 },
    ])
    mocks.translateSubtitles.mockResolvedValue([
      { text: "Hello.", start: 0, end: 1000, translation: "" },
    ])

    await expect(adapter.downloadTranslatedSubtitles()).rejects.toThrow()

    expect(mocks.downloadSubtitlesAsSrt).not.toHaveBeenCalled()
  })

  it("aborts translated export before later batches when an earlier batch is incomplete", async () => {
    const { adapter } = createAdapter([
      { text: "Hello.", start: 0, end: 1000 },
    ])
    const fragments = Array.from({ length: 11 }, (_, index) => ({
      text: `Line ${index + 1}.`,
      start: index * 1000,
      end: (index + 1) * 1000,
    }))
    vi.spyOn(adapter as any, "buildExportProcessedSubtitles").mockResolvedValue(fragments)
    mocks.translateSubtitles
      .mockResolvedValueOnce([
        { text: "Line 1.", start: 0, end: 1000, translation: "" },
        ...fragments.slice(1, 5).map(fragment => ({
          ...fragment,
          translation: `zh:${fragment.text}`,
        })),
      ])

    await expect(adapter.downloadTranslatedSubtitles()).rejects.toThrow()

    expect(mocks.translateSubtitles).toHaveBeenCalledTimes(1)
    expect(mocks.downloadSubtitlesAsSrt).not.toHaveBeenCalled()
  })

  it("does not download translated subtitles when source and target languages match", async () => {
    const { adapter } = createAdapter([
      { text: "Hello.", start: 0, end: 1000 },
    ])
    mocks.getLocalConfig.mockResolvedValue({
      language: {
        targetCode: "eng",
      },
      providersConfig: [],
      videoSubtitles: {
        aiSegmentation: false,
        providerId: null,
      },
    })

    await expect(adapter.downloadTranslatedSubtitles()).rejects.toThrow()

    expect(mocks.translateSubtitles).not.toHaveBeenCalled()
    expect(mocks.downloadSubtitlesAsSrt).not.toHaveBeenCalled()
  })

  it("retries a timing-degraded AI segmented export chunk as smaller chunks", async () => {
    const { adapter } = createAdapter([
      { text: "A", start: 0, end: 10000 },
      { text: "B", start: 10000, end: 20000 },
      { text: "C", start: 20000, end: 30000 },
      { text: "D", start: 30000, end: 40000 },
      { text: "E", start: 40000, end: 50000 },
      { text: "F", start: 50000, end: 55000 },
    ])
    mocks.getLocalConfig.mockResolvedValue({
      language: {},
      providersConfig: [],
      videoSubtitles: {
        aiSegmentation: true,
        providerId: "test-provider",
      },
    })
    mocks.aiSegmentBlock
      .mockResolvedValueOnce([
        { text: "A B C D E", start: 0, end: 10000 },
        { text: "F", start: 50000, end: 55000 },
      ])
      .mockResolvedValueOnce([
        { text: "A B C", start: 0, end: 30000 },
      ])
      .mockResolvedValueOnce([
        { text: "D E F", start: 30000, end: 55000 },
      ])
    mocks.translateSubtitles.mockImplementation(async (fragments: SubtitlesFragment[]) =>
      fragments.map(fragment => ({
        ...fragment,
        translation: `zh:${fragment.text}`,
      })),
    )

    await adapter.downloadTranslatedSubtitles()

    expect(mocks.aiSegmentBlock).toHaveBeenCalledTimes(3)
    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith({
      subtitles: [
        { text: "zh:A B C", start: 0, end: 30000 },
        { text: "zh:D E F", start: 30000, end: 55000 },
      ],
      pageTitle: "Test video",
      videoId: undefined,
      suffix: "translated",
    })
  })

  it("falls back to source processed timing when smaller AI chunks still have timing gaps", async () => {
    const { adapter } = createAdapter([
      { text: "A.", start: 0, end: 10000 },
      { text: "B.", start: 10000, end: 20000 },
      { text: "C.", start: 20000, end: 30000 },
      { text: "D.", start: 30000, end: 40000 },
      { text: "E.", start: 40000, end: 50000 },
      { text: "F.", start: 50000, end: 55000 },
    ])
    mocks.getLocalConfig.mockResolvedValue({
      language: {},
      providersConfig: [],
      videoSubtitles: {
        aiSegmentation: true,
        providerId: "test-provider",
      },
    })
    mocks.aiSegmentBlock
      .mockResolvedValueOnce([
        { text: "A B C D E", start: 0, end: 10000 },
        { text: "F", start: 50000, end: 55000 },
      ])
      .mockResolvedValueOnce([
        { text: "A B C", start: 0, end: 10000 },
      ])
    mocks.translateSubtitles.mockImplementation(async (fragments: SubtitlesFragment[]) =>
      fragments.map(fragment => ({
        ...fragment,
        translation: `zh:${fragment.text}`,
      })),
    )

    await adapter.downloadTranslatedSubtitles()

    expect(mocks.aiSegmentBlock).toHaveBeenCalledTimes(2)
    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith({
      subtitles: [
        { text: "zh:A. B. C. D. E. F.", start: 0, end: 55000 },
      ],
      pageTitle: "Test video",
      videoId: undefined,
      suffix: "translated",
    })
  })

  it("falls back to source processed timing when AI segmentation fails during export", async () => {
    const { adapter } = createAdapter([
      { text: "Hello.", start: 0, end: 1000 },
      { text: "World.", start: 1000, end: 2000 },
    ])
    mocks.getLocalConfig.mockResolvedValue({
      language: {},
      providersConfig: [],
      videoSubtitles: {
        aiSegmentation: true,
        providerId: "test-provider",
      },
    })
    mocks.aiSegmentBlock.mockRejectedValue(new Error("AI segmentation failed"))
    mocks.translateSubtitles.mockImplementation(async (fragments: SubtitlesFragment[]) =>
      fragments.map(fragment => ({
        ...fragment,
        translation: `zh:${fragment.text}`,
      })),
    )

    await adapter.downloadTranslatedSubtitles()

    expect(mocks.aiSegmentBlock).toHaveBeenCalledTimes(1)
    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith({
      subtitles: [
        { text: "zh:Hello. World.", start: 0, end: 2000 },
      ],
      pageTitle: "Test video",
      videoId: undefined,
      suffix: "translated",
    })
  })

  it("continues translated export when subtitle summary fetch fails", async () => {
    const { adapter } = createAdapter([
      { text: "Hello.", start: 0, end: 1000 },
      { text: "World.", start: 1000, end: 2000 },
    ])
    mocks.getLocalConfig.mockResolvedValue({
      language: {},
      providersConfig: [{
        id: "test-provider",
        name: "Test Provider",
        provider: "openai",
        enabled: true,
        apiKey: "sk-test",
        model: {
          model: "gpt-5-mini",
          isCustomModel: false,
          customModel: null,
        },
      }],
      videoSubtitles: {
        aiSegmentation: false,
        providerId: "test-provider",
      },
    })
    mocks.fetchSubtitlesSummary.mockRejectedValue(new Error("Summary failed"))
    mocks.translateSubtitles.mockImplementation(async (fragments: SubtitlesFragment[]) =>
      fragments.map(fragment => ({
        ...fragment,
        translation: `zh:${fragment.text}`,
      })),
    )

    await adapter.downloadTranslatedSubtitles()

    expect(mocks.fetchSubtitlesSummary).toHaveBeenCalledTimes(1)
    expect(mocks.translateSubtitles).toHaveBeenCalledWith(
      [
        { text: "Hello. World.", start: 0, end: 2000 },
      ],
      {
        videoTitle: "Test video",
        subtitlesTextContent: "Hello.World.",
        summary: null,
      },
    )
    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith({
      subtitles: [
        { text: "zh:Hello. World.", start: 0, end: 2000 },
      ],
      pageTitle: "Test video",
      videoId: undefined,
      suffix: "translated",
    })
  })
})
