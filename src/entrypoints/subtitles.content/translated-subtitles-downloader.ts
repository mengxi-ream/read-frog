import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import type { Config } from "@/types/config/config"
import type { SubtitlesFetcher } from "@/utils/subtitles/fetchers/types"
import type { SubtitlesVideoContext } from "@/utils/subtitles/processor/translator"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { toast } from "sonner"
import { getProviderConfigById } from "@/utils/config/helpers"
import { getLocalConfig } from "@/utils/config/storage"
import { MAX_GAP_MS, PROCESS_LOOK_AHEAD_MS, TRANSLATION_BATCH_SIZE } from "@/utils/constants/subtitles"
import { resolveLanguageCodeFromLocale } from "@/utils/content/page-language"
import { i18n } from "@/utils/i18n"
import { aiSegmentBlock } from "@/utils/subtitles/processor/ai-segmentation"
import { optimizeSubtitles } from "@/utils/subtitles/processor/optimizer"
import { buildSubtitlesSummaryContextHash, fetchSubtitlesSummary, translateSubtitles } from "@/utils/subtitles/processor/translator"
import { downloadSubtitlesAsSrt } from "@/utils/subtitles/srt"
import { subtitlesStore, TranslatedDownloadPhase, translatedSubtitlesDownloadStatusAtom } from "./atoms"

const SUCCESS_MESSAGE_DURATION_MS = 4000
const MAX_COLLAPSED_AI_SEGMENT_DURATION_MS = 1
const TRANSLATED_EXPORT_BATCH_CONCURRENCY = 2

export class TranslatedSubtitlesDownloader {
  private isDownloading = false
  private operationId = 0
  private successTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(
    private fetcher: SubtitlesFetcher,
    private config: PlatformConfig,
  ) {}

  download = async (): Promise<void> => {
    if (this.isDownloading) {
      return
    }

    this.clearSuccessTimeout()
    this.isDownloading = true
    const operationId = ++this.operationId
    const pageTitle = document.title || ""
    const videoId = this.config.getVideoId?.()
    this.setStatus(TranslatedDownloadPhase.Checking, null)

    try {
      const configSnapshot = await getLocalConfig()
      this.assertActive(operationId)
      if (!configSnapshot) {
        throw new Error(i18n.t("subtitles.errors.translatedExportFailed"))
      }

      const sourceSubtitles = await this.fetcher.fetch()
      this.assertActive(operationId)
      if (sourceSubtitles.length === 0) {
        throw new Error(i18n.t("subtitles.errors.noSubtitlesFound"))
      }

      this.assertDifferentTargetLanguage(configSnapshot)
      this.setStatus(TranslatedDownloadPhase.Preparing, 0)

      const sourceProcessedSubtitles = this.fetcher.isPreSegmented?.()
        ? [...sourceSubtitles]
        : optimizeSubtitles(sourceSubtitles, this.fetcher.getSourceLanguage())
      const translatedSubtitles = await this.buildCompleteTranslatedSubtitles(
        sourceSubtitles,
        sourceProcessedSubtitles,
        configSnapshot,
        operationId,
        pageTitle,
      )

      this.assertActive(operationId)
      await downloadSubtitlesAsSrt({
        subtitles: translatedSubtitles.map(({ translation, ...fragment }) => ({
          ...fragment,
          text: translation ?? "",
        })),
        pageTitle,
        videoId,
        suffix: "translated",
      })
      this.assertActive(operationId)

      this.setStatus(TranslatedDownloadPhase.Complete, null)
      this.successTimeout = setTimeout(() => {
        if (!this.isActive(operationId)) {
          return
        }
        this.successTimeout = null
        this.setStatus(TranslatedDownloadPhase.Idle, null)
      }, SUCCESS_MESSAGE_DURATION_MS)
    }
    catch (error) {
      if (!this.isActive(operationId)) {
        return
      }
      toast.error(error instanceof Error ? error.message : String(error))
      this.setStatus(TranslatedDownloadPhase.Idle, null)
    }
    finally {
      if (this.isActive(operationId)) {
        this.isDownloading = false
      }
    }
  }

  dispose(): void {
    this.operationId++
    this.isDownloading = false
    this.clearSuccessTimeout()
    this.setStatus(TranslatedDownloadPhase.Idle, null)
  }

  private clearSuccessTimeout(): void {
    if (this.successTimeout !== null) {
      clearTimeout(this.successTimeout)
      this.successTimeout = null
    }
  }

  private setStatus(phase: TranslatedDownloadPhase, progress: number | null): void {
    subtitlesStore.set(translatedSubtitlesDownloadStatusAtom, { phase, progress })
  }

  private isActive(operationId: number): boolean {
    return operationId === this.operationId
  }

  private assertActive(operationId: number): void {
    if (!this.isActive(operationId)) {
      throw new Error("Translated subtitle download was disposed")
    }
  }

  private assertDifferentTargetLanguage(config: Config): void {
    const targetLanguage = config.language.targetCode
    const sourceLanguage = resolveLanguageCodeFromLocale(this.fetcher.getSourceLanguage())

    if (targetLanguage && sourceLanguage && sourceLanguage === targetLanguage) {
      throw new Error(i18n.t("subtitles.errors.translatedExportSameLanguage"))
    }
  }

  private async buildCompleteTranslatedSubtitles(
    sourceSubtitles: SubtitlesFragment[],
    sourceProcessedSubtitles: SubtitlesFragment[],
    config: Config,
    operationId: number,
    pageTitle: string,
  ): Promise<SubtitlesFragment[]> {
    const fragments = await this.buildExportProcessedSubtitles(
      sourceSubtitles,
      sourceProcessedSubtitles,
      config,
      operationId,
    )
    this.assertActive(operationId)
    const videoContext = await this.buildExportVideoContext(sourceSubtitles, config, operationId, pageTitle)
    this.assertActive(operationId)
    const translatedFragments: SubtitlesFragment[] = []
    let translatedCount = 0
    const batches = this.buildTranslationBatches(fragments)

    for (let index = 0; index < batches.length; index += TRANSLATED_EXPORT_BATCH_CONCURRENCY) {
      const batchWindow = batches.slice(index, index + TRANSLATED_EXPORT_BATCH_CONCURRENCY)
      const translatedBatchWindow = await Promise.all(
        batchWindow.map(async (batch) => {
          const translatedBatch = await translateSubtitles(batch, videoContext, config)
          this.assertActive(operationId)
          if (
            translatedBatch.length !== batch.length
            || this.hasIncompleteTranslatedFragments(translatedBatch)
          ) {
            throw new Error(i18n.t("subtitles.errors.translatedExportIncomplete"))
          }

          return translatedBatch
        }),
      )
      this.assertActive(operationId)
      for (const translatedBatch of translatedBatchWindow) {
        translatedFragments.push(...translatedBatch)
        translatedCount += translatedBatch.length
        this.setStatus(
          TranslatedDownloadPhase.Translating,
          Math.min(100, Math.round((translatedCount / fragments.length) * 100)),
        )
      }
    }

    if (
      translatedFragments.length !== fragments.length
      || this.hasIncompleteTranslatedFragments(translatedFragments)
    ) {
      throw new Error(i18n.t("subtitles.errors.translatedExportIncomplete"))
    }

    return translatedFragments
  }

  private hasIncompleteTranslatedFragments(fragments: SubtitlesFragment[]): boolean {
    return fragments.some(fragment => !fragment.translation?.trim())
  }

  private buildTranslationBatches(fragments: SubtitlesFragment[]): SubtitlesFragment[][] {
    const batches: SubtitlesFragment[][] = []

    for (let index = 0; index < fragments.length; index += TRANSLATION_BATCH_SIZE) {
      batches.push(fragments.slice(index, index + TRANSLATION_BATCH_SIZE))
    }

    return batches
  }

  private async buildExportProcessedSubtitles(
    sourceSubtitles: SubtitlesFragment[],
    sourceProcessedSubtitles: SubtitlesFragment[],
    config: Config,
    operationId: number,
  ): Promise<SubtitlesFragment[]> {
    if (!config.videoSubtitles.aiSegmentation || this.fetcher.isPreSegmented?.()) {
      return [...sourceProcessedSubtitles]
    }

    const result: SubtitlesFragment[] = []

    for (const chunk of this.buildSourceSubtitleChunks(sourceSubtitles)) {
      result.push(...await this.buildExportProcessedChunk(chunk, config, operationId))
      this.assertActive(operationId)
    }

    return result.sort((a, b) => a.start - b.start)
  }

  private async buildExportProcessedChunk(
    chunk: SubtitlesFragment[],
    config: Config,
    operationId: number,
  ): Promise<SubtitlesFragment[]> {
    const sourceLanguage = this.fetcher.getSourceLanguage()
    let segmented: SubtitlesFragment[]

    try {
      segmented = await aiSegmentBlock(chunk, config)
      this.assertActive(operationId)
    }
    catch {
      return optimizeSubtitles(chunk, sourceLanguage)
    }

    const optimized = optimizeSubtitles(segmented, sourceLanguage)

    if (!this.hasUnsafeSegmentedExportTiming(chunk, segmented, optimized)) {
      return optimized
    }

    const retryChunks = this.buildSourceSubtitleChunks(chunk, PROCESS_LOOK_AHEAD_MS / 2)
    if (retryChunks.length > 1) {
      const retryResult: SubtitlesFragment[] = []

      for (const retryChunk of retryChunks) {
        let retrySegmented: SubtitlesFragment[]

        try {
          retrySegmented = await aiSegmentBlock(retryChunk, config)
          this.assertActive(operationId)
        }
        catch {
          return optimizeSubtitles(chunk, sourceLanguage)
        }

        const retryOptimized = optimizeSubtitles(retrySegmented, sourceLanguage)

        if (this.hasUnsafeSegmentedExportTiming(retryChunk, retrySegmented, retryOptimized)) {
          return optimizeSubtitles(chunk, sourceLanguage)
        }

        retryResult.push(...retryOptimized)
      }

      return retryResult
    }

    return optimizeSubtitles(chunk, sourceLanguage)
  }

  private hasUnsafeExportTiming(source: SubtitlesFragment[], candidate: SubtitlesFragment[]): boolean {
    return this.hasInvalidTimingShape(source, candidate) || this.hasTimingCoverageGap(source, candidate)
  }

  private hasUnsafeSegmentedExportTiming(
    source: SubtitlesFragment[],
    segmented: SubtitlesFragment[],
    optimized: SubtitlesFragment[],
  ): boolean {
    return this.hasInvalidTimingShape(source, segmented) || this.hasUnsafeExportTiming(source, optimized)
  }

  private buildSourceSubtitleChunks(
    subtitles: SubtitlesFragment[],
    maxDurationMs = PROCESS_LOOK_AHEAD_MS,
  ): SubtitlesFragment[][] {
    const chunks: SubtitlesFragment[][] = []
    let index = 0

    while (index < subtitles.length) {
      const chunkStart = subtitles[index].start
      const chunkEnd = chunkStart + maxDurationMs
      const chunk: SubtitlesFragment[] = []

      while (index < subtitles.length && subtitles[index].start < chunkEnd) {
        chunk.push(subtitles[index])
        index++
      }

      chunks.push(chunk)
    }

    return chunks
  }

  private hasTimingCoverageGap(source: SubtitlesFragment[], candidate: SubtitlesFragment[]): boolean {
    const sourceCoverage = this.mergeCoverageIntervals(source)
    const candidateCoverage = this.mergeCoverageIntervals(candidate)

    for (const sourceInterval of sourceCoverage) {
      let coveredUntil = sourceInterval.start

      for (const candidateInterval of candidateCoverage) {
        if (candidateInterval.end <= coveredUntil) {
          continue
        }
        if (candidateInterval.start >= sourceInterval.end) {
          break
        }

        const overlapStart = Math.max(candidateInterval.start, sourceInterval.start)
        if (overlapStart - coveredUntil > MAX_GAP_MS) {
          return true
        }

        coveredUntil = Math.max(coveredUntil, Math.min(candidateInterval.end, sourceInterval.end))
      }

      if (sourceInterval.end - coveredUntil > MAX_GAP_MS) {
        return true
      }
    }

    return false
  }

  private hasInvalidTimingShape(source: SubtitlesFragment[], candidate: SubtitlesFragment[]): boolean {
    if (source.length === 0 || candidate.length === 0) {
      return true
    }

    const sourceStart = Math.min(...source.map(fragment => fragment.start))
    const sourceEnd = Math.max(...source.map(fragment => fragment.end))
    const sortedCandidates = [...candidate].sort((a, b) => a.start - b.start || a.end - b.end)

    for (let index = 0; index < sortedCandidates.length; index++) {
      const fragment = sortedCandidates[index]
      if (
        !Number.isFinite(fragment.start)
        || !Number.isFinite(fragment.end)
        || fragment.end - fragment.start <= MAX_COLLAPSED_AI_SEGMENT_DURATION_MS
        || fragment.start < sourceStart
        || fragment.end > sourceEnd
      ) {
        return true
      }

      const previous = sortedCandidates[index - 1]
      if (previous && previous.end > fragment.start) {
        return true
      }
    }

    return false
  }

  private mergeCoverageIntervals(fragments: SubtitlesFragment[]): Array<{ start: number, end: number }> {
    const intervals = fragments
      .filter(fragment => fragment.end > fragment.start)
      .map(fragment => ({ start: fragment.start, end: fragment.end }))
      .sort((a, b) => a.start - b.start)

    const merged: Array<{ start: number, end: number }> = []

    for (const interval of intervals) {
      const previous = merged.at(-1)
      if (previous && interval.start - previous.end <= MAX_GAP_MS) {
        previous.end = Math.max(previous.end, interval.end)
      }
      else {
        merged.push({ ...interval })
      }
    }

    return merged
  }

  private async buildExportVideoContext(
    sourceSubtitles: SubtitlesFragment[],
    config: Config,
    operationId: number,
    pageTitle: string,
  ): Promise<SubtitlesVideoContext> {
    const providerConfig = getProviderConfigById(config.providersConfig, config.videoSubtitles.providerId)
    const videoContext: SubtitlesVideoContext = {
      videoTitle: pageTitle,
      subtitlesTextContent: sourceSubtitles.map(fragment => fragment.text).join(""),
    }
    const summaryContextHash = buildSubtitlesSummaryContextHash(videoContext, providerConfig)

    if (summaryContextHash) {
      try {
        videoContext.summary = await fetchSubtitlesSummary(videoContext, config)
        this.assertActive(operationId)
      }
      catch {
        videoContext.summary = null
      }
    }

    return videoContext
  }
}
