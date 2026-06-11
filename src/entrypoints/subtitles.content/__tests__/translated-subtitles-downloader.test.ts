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

  it.each([
    ["missing result", (fragments: SubtitlesFragment[]) => translated(fragments.slice(0, -1))],
    ["empty translation", (fragments: SubtitlesFragment[]) => fragments.map(fragment => ({ ...fragment, translation: "" }))],
  ])("fails closed for an incomplete batch: %s", async (_, resultFor) => {
    const fragments = lines(5)
    mocks.translateSubtitles.mockResolvedValue(resultFor(fragments))

    await createDownloader(fragments).downloader.download()

    expect(mocks.downloadSubtitlesAsSrt).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith("subtitles.errors.translatedExportIncomplete")
    expect(status()).toEqual({ phase: TranslatedDownloadPhase.Error, progress: null })
  })

  it("rejects same-language export", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig({ targetCode: "eng" }))

    await createDownloader(lines(1)).downloader.download()

    expect(mocks.translateSubtitles).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith("subtitles.errors.translatedExportSameLanguage")
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
    let finishOldTranslation!: (value: SubtitlesFragment[]) => void
    mocks.translateSubtitles
      .mockImplementationOnce(async () => await new Promise<SubtitlesFragment[]>((resolve) => {
        finishOldTranslation = resolve
      }))
      .mockImplementationOnce(async (fragments: SubtitlesFragment[]) => translated(fragments))
    const { downloader, fetcher } = createDownloader(lines(1))

    const oldDownload = downloader.download()
    await vi.waitFor(() => expect(mocks.translateSubtitles).toHaveBeenCalledTimes(1))
    downloader.dispose()
    const newDownload = downloader.download()
    await newDownload
    finishOldTranslation(translated(lines(1)))
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
