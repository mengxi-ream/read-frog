import type { AdapterContext } from "./adapter-context"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { getSourceDocumentTitle } from "@/utils/content/document-title"
import { NoSubtitlesError } from "@/utils/subtitles/errors"
import { optimizeSubtitles } from "@/utils/subtitles/processor/optimizer"
import { downloadSubtitlesAsSrt } from "@/utils/subtitles/srt"
import { createOperationGeneration } from "./operation-generation"

type SourceSubtitlesCacheDeps = Pick<AdapterContext, "config" | "getFetcher">

export class SourceSubtitlesCache {
  private readonly config: SourceSubtitlesCacheDeps["config"]
  private readonly getFetcher: SourceSubtitlesCacheDeps["getFetcher"]
  sourceSubtitles: SubtitlesFragment[] = []
  sourceProcessedSubtitles: SubtitlesFragment[] = []
  sourceVideoId: string | null = null
  private readonly sourceCacheGeneration = createOperationGeneration()

  constructor({ config, getFetcher }: SourceSubtitlesCacheDeps) {
    this.config = config
    this.getFetcher = getFetcher
  }

  downloadSourceSubtitles = async () => {
    await this.getOrLoadSourceSubtitles()

    await downloadSubtitlesAsSrt({
      subtitles: this.sourceProcessedSubtitles,
      pageTitle: getSourceDocumentTitle(),
      videoId: this.config.getVideoId?.(),
    })
  }

  async getOrLoadSourceSubtitles(signal?: AbortSignal): Promise<SubtitlesFragment[]> {
    const currentVideoId = this.config.getVideoId?.() ?? null
    const fetcher = this.getFetcher()
    const cacheGeneration = this.sourceCacheGeneration.current()
    const assertCurrent = () => {
      signal?.throwIfAborted()
      if (
        !this.sourceCacheGeneration.isCurrent(cacheGeneration) ||
        fetcher !== this.getFetcher() ||
        currentVideoId !== (this.config.getVideoId?.() ?? null)
      ) {
        throw new DOMException("Subtitle load superseded", "AbortError")
      }
    }
    assertCurrent()
    // Asking the fetcher can cost a round trip to the page, so skip it when nothing is cached.
    const hasCachedSource = this.sourceVideoId === currentVideoId && this.sourceSubtitles.length > 0
    const useSameTrack = hasCachedSource && (await fetcher.shouldUseSameTrack())
    assertCurrent()

    if (useSameTrack && this.sourceVideoId === currentVideoId && this.sourceSubtitles.length > 0) {
      return this.sourceSubtitles
    }

    let hasSubtitles: boolean
    try {
      hasSubtitles = await fetcher.hasAvailableSubtitles()
    } finally {
      // A lookup that failed after its video was left reports as superseded, not as its failure.
      assertCurrent()
    }
    if (!hasSubtitles) {
      throw new NoSubtitlesError()
    }

    const subtitles = await fetcher.fetch()
    assertCurrent()
    if (subtitles.length === 0) {
      throw new NoSubtitlesError()
    }

    this.sourceVideoId = currentVideoId
    this.sourceSubtitles = subtitles
    this.sourceProcessedSubtitles = this.buildSourceProcessedSubtitles(subtitles)

    return subtitles
  }

  private buildSourceProcessedSubtitles(rawSubtitles: SubtitlesFragment[]): SubtitlesFragment[] {
    if (this.getFetcher().isPreSegmented?.()) return rawSubtitles
    const sourceLanguage = this.getFetcher().getSourceLanguage()
    return optimizeSubtitles(rawSubtitles, sourceLanguage)
  }

  private clearSourceProcessedSubtitles() {
    this.sourceProcessedSubtitles = []
  }

  clearSourceCache() {
    this.sourceCacheGeneration.next()
    this.sourceSubtitles = []
    this.clearSourceProcessedSubtitles()
    this.sourceVideoId = null
  }
}
