import type { AdapterContext } from "./adapter-context"
import type { SourceSubtitlesCache } from "./source-subtitles-cache"
import type { Config } from "@/types/config/config"
import { requestVideoSummary } from "@/utils/subtitles/video-summary"
import { currentVideoIdAtom, subtitlesStore, videoSummaryPartialAtom } from "../atoms"

type VideoSummaryStreamDeps = Pick<AdapterContext, "config"> & {
  sourceCache: Pick<SourceSubtitlesCache, "getOrLoadSourceSubtitles" | "sourceProcessedSubtitles">
}

export class VideoSummaryStream {
  private readonly config: VideoSummaryStreamDeps["config"]
  private readonly sourceCache: VideoSummaryStreamDeps["sourceCache"]
  private summaryAbortController: AbortController | null = null

  constructor({ config, sourceCache }: VideoSummaryStreamDeps) {
    this.config = config
    this.sourceCache = sourceCache
  }

  generateVideoSummary = async (config: Config, videoId = this.config.getVideoId?.() ?? null) => {
    // A stale query must not cancel the new video's stream or borrow its subtitles.
    if (
      videoId === null ||
      videoId !== subtitlesStore.get(currentVideoIdAtom) ||
      videoId !== (this.config.getVideoId?.() ?? null)
    ) {
      throw new DOMException("Video summary superseded", "AbortError")
    }
    this.summaryAbortController?.abort()
    const abortController = new AbortController()
    this.summaryAbortController = abortController
    const { signal } = abortController
    subtitlesStore.set(videoSummaryPartialAtom, "")
    try {
      await this.sourceCache.getOrLoadSourceSubtitles(signal)
      signal.throwIfAborted()
      const summary = await requestVideoSummary(this.sourceCache.sourceProcessedSubtitles, config, {
        signal,
        onChunk: (partialMarkdown) => {
          if (!signal.aborted) {
            subtitlesStore.set(videoSummaryPartialAtom, partialMarkdown)
          }
        },
      })
      signal.throwIfAborted()
      return summary
    } finally {
      if (this.summaryAbortController === abortController) {
        this.summaryAbortController = null
      }
    }
  }

  prepareSummaryForNavigation() {
    subtitlesStore.set(currentVideoIdAtom, null)
    this.cancelVideoSummary()
  }

  private cancelVideoSummary() {
    this.summaryAbortController?.abort()
    this.summaryAbortController = null
    subtitlesStore.set(videoSummaryPartialAtom, "")
  }
}
