import type { AiSubtitlesContext } from "../../ai/request-ai-subtitles"
import type { SubtitlesFragment } from "../../types"
import type { SubtitlesFetcher } from "../types"
import { i18n } from "@/utils/i18n"
import { OverlaySubtitlesError } from "@/utils/subtitles/errors"
import { requestAiSubtitles } from "../../ai/request-ai-subtitles"

const abortError = () => new DOMException("Aborted", "AbortError")

export class AiSubtitlesFetcher implements SubtitlesFetcher {
  private subtitles: SubtitlesFragment[] = []
  private sourceLanguage: string = ""
  private cachedVideoId: string | null = null
  // Cleanup aborts every request of the session, also one still resolving its context.
  private session = new AbortController()
  private inFlight: { videoId: string; promise: Promise<SubtitlesFragment[]> } | null = null

  constructor(private createAiSubtitlesContext: () => Promise<AiSubtitlesContext | null>) {}

  async fetch(): Promise<SubtitlesFragment[]> {
    const { signal } = this.session
    const ctx = await this.createAiSubtitlesContext()
    if (signal.aborted) {
      throw abortError()
    }
    if (!ctx) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }

    if (this.subtitles.length > 0 && this.cachedVideoId === ctx.videoId) {
      return this.subtitles
    }

    if (this.inFlight?.videoId === ctx.videoId) {
      return this.inFlight.promise
    }

    const promise = this.runRequest({ ctx, signal })
    this.inFlight = { videoId: ctx.videoId, promise }
    return promise
  }

  private async runRequest({
    ctx,
    signal,
  }: {
    ctx: AiSubtitlesContext
    signal: AbortSignal
  }): Promise<SubtitlesFragment[]> {
    try {
      const { segments, detectedLanguage } = await requestAiSubtitles(ctx, { signal })

      if (signal.aborted || (await this.playsOtherVideo(ctx.videoId))) {
        throw abortError()
      }

      this.subtitles = segments
      this.sourceLanguage = detectedLanguage
      this.cachedVideoId = ctx.videoId

      return this.subtitles
    } finally {
      if (this.inFlight?.videoId === ctx.videoId) {
        this.inFlight = null
      }
    }
  }

  // A context missing for a moment names no other video: a change of video resets the session.
  private async playsOtherVideo(videoId: string): Promise<boolean> {
    const ctx = await this.createAiSubtitlesContext()
    return ctx !== null && ctx.videoId !== videoId
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  isPreSegmented(): boolean {
    return true
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    return (await this.createAiSubtitlesContext()) !== null
  }

  async shouldUseSameTrack(): Promise<boolean> {
    return (
      this.subtitles.length > 0 &&
      this.cachedVideoId !== null &&
      !(await this.playsOtherVideo(this.cachedVideoId))
    )
  }

  cleanup(): void {
    this.subtitles = []
    this.sourceLanguage = ""
    this.cachedVideoId = null
    this.session.abort()
    this.session = new AbortController()
    this.inFlight = null
  }
}
