import type { Config } from "@/types/config/config"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { subtitlesStore, TranslatedDownloadPhase, translatedSubtitlesDownloadStatusAtom } from "../atoms"
import { TranslatedSubtitlesDownloader } from "../translated-subtitles-downloader"

const mocks = vi.hoisted(() => ({
  aiSegmentBlock: vi.fn(),
  downloadSubtitlesAsSrt: vi.fn(),
  fetchSubtitlesSummary: vi.fn(),
  getLocalConfig: vi.fn(),
  toastError: vi.fn(),
  translateSubtitles: vi.fn(),
}))

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))
vi.mock("@/utils/config/storage", () => ({ getLocalConfig: mocks.getLocalConfig }))
vi.mock("@/utils/subtitles/processor/ai-segmentation", () => ({ aiSegmentBlock: mocks.aiSegmentBlock }))
vi.mock("@/utils/subtitles/processor/translator", () => ({
  buildSubtitlesSummaryContextHash: () => "summary-hash",
  fetchSubtitlesSummary: mocks.fetchSubtitlesSummary,
  translateSubtitles: mocks.translateSubtitles,
}))
vi.mock("@/utils/subtitles/srt", () => ({ downloadSubtitlesAsSrt: mocks.downloadSubtitlesAsSrt }))

function createConfig({
  aiSegmentation = false,
  targetCode = "cmn",
}: {
  aiSegmentation?: boolean
  targetCode?: Config["language"]["targetCode"]
} = {}): Config {
  const provider = DEFAULT_PROVIDER_CONFIG.openai
  return {
    ...DEFAULT_CONFIG,
    language: { ...DEFAULT_CONFIG.language, sourceCode: "eng", targetCode },
    providersConfig: [provider],
    videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, providerId: provider.id, aiSegmentation },
  }
}

function createDownloader(fragments: SubtitlesFragment[], preSegmented = true) {
  const fetcher = {
    fetch: vi.fn().mockResolvedValue(fragments),
    cleanup: vi.fn(),
    shouldUseSameTrack: vi.fn().mockResolvedValue(false),
    getSourceLanguage: () => "en",
    hasAvailableSubtitles: vi.fn().mockResolvedValue(true),
    isPreSegmented: () => preSegmented,
  }
  return {
    downloader: new TranslatedSubtitlesDownloader(fetcher, {
      selectors: { video: "video", playerContainer: ".player", controlsBar: ".controls", nativeSubtitles: ".native" },
      events: {},
      getVideoId: () => "video-id",
    }),
    fetcher,
  }
}

function lines(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    text: `Line ${index + 1}.`,
    start: index * 1000,
    end: (index + 1) * 1000,
  }))
}

function translated(fragments: SubtitlesFragment[]) {
  return fragments.map(fragment => ({ ...fragment, translation: `zh:${fragment.text}` }))
}

function status() {
  return subtitlesStore.get(translatedSubtitlesDownloadStatusAtom)
}

describe("translatedSubtitlesDownloader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.stubGlobal("document", { title: "Test video" })
    subtitlesStore.set(translatedSubtitlesDownloadStatusAtom, {
      phase: TranslatedDownloadPhase.Idle,
      progress: null,
    })
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.fetchSubtitlesSummary.mockResolvedValue(null)
    mocks.translateSubtitles.mockImplementation(async (fragments: SubtitlesFragment[]) => translated(fragments))
  })

  it("uses one config snapshot while reporting batch progress and downloading the full SRT", async () => {
    const config = createConfig()
    const fragments = lines(6)
    const { downloader } = createDownloader(fragments)
    const statuses: Array<ReturnType<typeof status>> = []
    mocks.getLocalConfig.mockResolvedValue(config)
    const unsubscribe = subtitlesStore.sub(translatedSubtitlesDownloadStatusAtom, () => statuses.push(status()))

    await downloader.download()
    unsubscribe()

    expect(mocks.getLocalConfig).toHaveBeenCalledTimes(1)
    expect(mocks.fetchSubtitlesSummary).toHaveBeenCalledWith(expect.any(Object), config)
    expect(mocks.translateSubtitles).toHaveBeenNthCalledWith(1, fragments.slice(0, 5), expect.any(Object), config)
    expect(mocks.translateSubtitles).toHaveBeenNthCalledWith(2, fragments.slice(5), expect.any(Object), config)
    expect(statuses).toEqual(expect.arrayContaining([
      { phase: TranslatedDownloadPhase.Checking, progress: null },
      { phase: TranslatedDownloadPhase.Preparing, progress: 0 },
      { phase: TranslatedDownloadPhase.Translating, progress: 83 },
      { phase: TranslatedDownloadPhase.Translating, progress: 100 },
      { phase: TranslatedDownloadPhase.Complete, progress: null },
    ]))
    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith(expect.objectContaining({
      subtitles: translated(fragments).map(({ translation, ...fragment }) => ({ ...fragment, text: translation })),
      videoId: "video-id",
      suffix: "translated",
    }))
  })

  it("translates exported SRT batches with a bounded two-batch window", async () => {
    const fragments = lines(15)
    const resolvers: Array<(value: SubtitlesFragment[]) => void> = []
    let activeBatches = 0
    let maxActiveBatches = 0
    mocks.translateSubtitles.mockImplementation(async () => {
      activeBatches += 1
      maxActiveBatches = Math.max(maxActiveBatches, activeBatches)
      const translatedBatch = await new Promise<SubtitlesFragment[]>(resolve => resolvers.push(resolve))
      activeBatches -= 1
      return translatedBatch
    })
    const { downloader } = createDownloader(fragments)

    const download = downloader.download()
    await vi.waitFor(() => expect(mocks.translateSubtitles).toHaveBeenCalledTimes(2))

    expect(maxActiveBatches).toBe(2)
    expect(mocks.translateSubtitles).toHaveBeenNthCalledWith(1, fragments.slice(0, 5), expect.any(Object), expect.any(Object))
    expect(mocks.translateSubtitles).toHaveBeenNthCalledWith(2, fragments.slice(5, 10), expect.any(Object), expect.any(Object))

    resolvers[1](translated(fragments.slice(5, 10)))
    await vi.waitFor(() => expect(activeBatches).toBe(1))
    expect(mocks.translateSubtitles).toHaveBeenCalledTimes(2)

    resolvers[0](translated(fragments.slice(0, 5)))
    await vi.waitFor(() => expect(mocks.translateSubtitles).toHaveBeenCalledTimes(3))
    expect(mocks.translateSubtitles).toHaveBeenNthCalledWith(3, fragments.slice(10), expect.any(Object), expect.any(Object))

    resolvers[2](translated(fragments.slice(10)))
    await download

    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith(expect.objectContaining({
      subtitles: translated(fragments).map(({ translation, ...fragment }) => ({ ...fragment, text: translation })),
    }))
  })

  it("fails closed when one concurrent export batch fails", async () => {
    const fragments = lines(10)
    let finishSlowBatch!: (value: SubtitlesFragment[]) => void
    mocks.translateSubtitles
      .mockRejectedValueOnce(new Error("Batch failed"))
      .mockImplementationOnce(async () => await new Promise<SubtitlesFragment[]>((resolve) => {
        finishSlowBatch = resolve
      }))
    const { downloader } = createDownloader(fragments)

    const download = downloader.download()
    await vi.waitFor(() => expect(mocks.translateSubtitles).toHaveBeenCalledTimes(2))
    await download

    expect(mocks.downloadSubtitlesAsSrt).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith("Batch failed")
    expect(status()).toEqual({ phase: TranslatedDownloadPhase.Idle, progress: null })

    finishSlowBatch(translated(fragments.slice(5)))
    await vi.waitFor(() => expect(status()).toEqual({ phase: TranslatedDownloadPhase.Idle, progress: null }))
  })

  it.each([
    ["missing result", (fragments: SubtitlesFragment[]) => translated(fragments.slice(0, -1))],
    ["empty translation", (fragments: SubtitlesFragment[]) => fragments.map(fragment => ({ ...fragment, translation: "" }))],
  ])("fails closed for an incomplete batch: %s", async (_, resultFor) => {
    const fragments = lines(5)
    mocks.translateSubtitles.mockResolvedValue(resultFor(fragments))

    await createDownloader(fragments).downloader.download()

    expect(mocks.downloadSubtitlesAsSrt).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith("subtitles.errors.translatedExportIncomplete")
    expect(status()).toEqual({ phase: TranslatedDownloadPhase.Idle, progress: null })
  })

  it("rejects same-language export before showing the preparing state", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig({ targetCode: "eng" }))
    const statuses: Array<ReturnType<typeof status>> = []
    const unsubscribe = subtitlesStore.sub(translatedSubtitlesDownloadStatusAtom, () => statuses.push(status()))

    await createDownloader(lines(1)).downloader.download()
    unsubscribe()

    expect(mocks.translateSubtitles).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith("subtitles.errors.translatedExportSameLanguage")
    expect(statuses).toEqual([
      { phase: TranslatedDownloadPhase.Checking, progress: null },
      { phase: TranslatedDownloadPhase.Idle, progress: null },
    ])
  })

  it("prevents concurrent duplicate downloads", async () => {
    let finish!: () => void
    mocks.translateSubtitles.mockImplementation(async (fragments: SubtitlesFragment[]) => {
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      return translated(fragments)
    })
    const { downloader, fetcher } = createDownloader(lines(1))

    const first = downloader.download()
    await vi.waitFor(() => expect(mocks.translateSubtitles).toHaveBeenCalled())
    const second = downloader.download()
    finish()
    await Promise.all([first, second])

    expect(fetcher.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledTimes(1)
  })

  it("invalidates an in-flight export on dispose and allows a new download", async () => {
    const fragments = lines(10)
    const finishOldTranslations: Array<(value: SubtitlesFragment[]) => void> = []
    mocks.translateSubtitles.mockImplementation(async (batch: SubtitlesFragment[]) => {
      if (finishOldTranslations.length < 2) {
        return await new Promise<SubtitlesFragment[]>(resolve => finishOldTranslations.push(resolve))
      }
      return translated(batch)
    })
    const { downloader, fetcher } = createDownloader(fragments)

    const oldDownload = downloader.download()
    await vi.waitFor(() => expect(mocks.translateSubtitles).toHaveBeenCalledTimes(2))
    downloader.dispose()
    const newDownload = downloader.download()
    await vi.waitFor(() => expect(mocks.translateSubtitles).toHaveBeenCalledTimes(4))
    await newDownload
    finishOldTranslations[0](translated(fragments.slice(0, 5)))
    finishOldTranslations[1](translated(fragments.slice(5)))
    await oldDownload

    expect(fetcher.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledTimes(1)
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(status().phase).toBe(TranslatedDownloadPhase.Complete)
  })

  it("falls back to optimized source timing when AI segmentation fails", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig({ aiSegmentation: true }))
    mocks.aiSegmentBlock.mockRejectedValue(new Error("Segmentation failed"))

    await createDownloader([
      { text: "Hello.", start: 0, end: 1000 },
      { text: "World.", start: 1000, end: 2000 },
    ], false).downloader.download()

    expect(mocks.aiSegmentBlock).toHaveBeenCalledTimes(1)
    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith(expect.objectContaining({
      subtitles: [{ text: "zh:Hello. World.", start: 0, end: 2000 }],
    }))
  })

  it("retries unsafe AI segmentation with smaller chunks before falling back", async () => {
    const source = [
      { text: "The first half of this transcript segment has enough words to stay readable.", start: 0, end: 29000 },
      { text: "The second half should be exported with its original safe timing after retry.", start: 30000, end: 59000 },
    ]
    const retryFirst = [{ ...source[0], text: "Retried first half." }]
    const retrySecond = [{ ...source[1], text: "Retried second half." }]
    mocks.getLocalConfig.mockResolvedValue(createConfig({ aiSegmentation: true }))
    mocks.aiSegmentBlock
      .mockResolvedValueOnce([{ text: "Collapsed.", start: 0, end: 1 }])
      .mockResolvedValueOnce(retryFirst)
      .mockResolvedValueOnce(retrySecond)

    await createDownloader(source, false).downloader.download()

    expect(mocks.aiSegmentBlock).toHaveBeenCalledTimes(3)
    expect(mocks.aiSegmentBlock).toHaveBeenNthCalledWith(1, source, expect.any(Object))
    expect(mocks.aiSegmentBlock).toHaveBeenNthCalledWith(2, [source[0]], expect.any(Object))
    expect(mocks.aiSegmentBlock).toHaveBeenNthCalledWith(3, [source[1]], expect.any(Object))
    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith(expect.objectContaining({
      subtitles: [
        { text: "zh:Retried first half.", start: 0, end: 29000 },
        { text: "zh:Retried second half.", start: 30000, end: 59000 },
      ],
    }))
  })

  it("falls back to optimized source timing when AI segmentation creates overlapping export cues", async () => {
    const questionText = "I was wondering whether you have tested scaling laws when source text is transformed into image inputs across many different controlled experiments."
    mocks.getLocalConfig.mockResolvedValue(createConfig({ aiSegmentation: true }))
    mocks.aiSegmentBlock.mockResolvedValue([
      { text: "Hello.", start: 0, end: 3420 },
      { text: questionText, start: 500, end: 3420 },
    ])

    await createDownloader([
      { text: "Hello.", start: 0, end: 500 },
      { text: questionText, start: 500, end: 3420 },
    ], false).downloader.download()

    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith(expect.objectContaining({
      subtitles: [
        { text: "zh:Hello.", start: 0, end: 500 },
        { text: `zh:${questionText}`, start: 500, end: 3420 },
      ],
    }))
  })

  it("falls back when optimization hides a raw collapsed AI segment", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig({ aiSegmentation: true }))
    mocks.aiSegmentBlock.mockResolvedValue([
      { text: "Hi.", start: 500, end: 501 },
      { text: "OK.", start: 501, end: 1000 },
    ])

    await createDownloader([
      { text: "Hi.", start: 0, end: 500 },
      { text: "OK.", start: 500, end: 1000 },
    ], false).downloader.download()

    expect(mocks.aiSegmentBlock).toHaveBeenCalledTimes(1)
    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith(expect.objectContaining({
      subtitles: [
        { text: "zh:Hi. OK.", start: 0, end: 1000 },
      ],
    }))
  })

  it("falls back to optimized source timing when AI segmentation collapses a cue to a boundary", async () => {
    const followUpText = "Actually this next cue contains enough words that it should remain separate from the short greeting during subtitle optimization across many different transcript timing examples."
    mocks.getLocalConfig.mockResolvedValue(createConfig({ aiSegmentation: true }))
    mocks.aiSegmentBlock.mockResolvedValue([
      { text: "Hi.", start: 500, end: 501 },
      { text: followUpText, start: 501, end: 3500 },
    ])

    await createDownloader([
      { text: "Hi.", start: 0, end: 500 },
      { text: followUpText, start: 500, end: 3500 },
    ], false).downloader.download()

    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalledWith(expect.objectContaining({
      subtitles: [
        { text: "zh:Hi.", start: 0, end: 500 },
        { text: `zh:${followUpText}`, start: 500, end: 3500 },
      ],
    }))
  })

  it("continues without a summary when summary generation fails", async () => {
    mocks.fetchSubtitlesSummary.mockRejectedValue(new Error("Summary failed"))
    await createDownloader(lines(1)).downloader.download()

    expect(mocks.translateSubtitles).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ summary: null }),
      expect.any(Object),
    )
    expect(mocks.downloadSubtitlesAsSrt).toHaveBeenCalled()
  })

  it("clears completion state when disposed", async () => {
    vi.useFakeTimers()
    const { downloader } = createDownloader(lines(1))

    await downloader.download()
    expect(status().phase).toBe(TranslatedDownloadPhase.Complete)
    downloader.dispose()
    await vi.runAllTimersAsync()

    expect(status()).toEqual({ phase: TranslatedDownloadPhase.Idle, progress: null })
  })
})
