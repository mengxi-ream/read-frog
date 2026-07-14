import type { AiSubtitlesContext } from "../../ai/request-ai-subtitles"
import type { SubtitlesFragment } from "../../types"
import type { SubtitlesFetcher } from "../types"
import { i18n } from "@/utils/i18n"
import { OverlaySubtitlesError } from "@/utils/subtitles/errors"
import { requestAiSubtitles } from "../../ai/request-ai-subtitles"

export class AiSubtitlesFetcher implements SubtitlesFetcher {
  private subtitles: SubtitlesFragment[] = []
  private sourceLanguage: string = ""
  private cachedVideoId: string | null = null
  private abortController: AbortController | null = null

  constructor(private createAiSubtitlesContext: () => AiSubtitlesContext | null) {}

  async fetch(): Promise<SubtitlesFragment[]> {
    const ctx = this.createAiSubtitlesContext()
    if (!ctx) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }

    if (this.subtitles.length > 0 && this.cachedVideoId === ctx.videoId) {
      return this.subtitles
    }

    this.abortController?.abort()
    const controller = new AbortController()
    this.abortController = controller

    const { segments, detectedLanguage } = await requestAiSubtitles(ctx, {
      signal: controller.signal,
    })

    if (this.createAiSubtitlesContext()?.videoId !== ctx.videoId) {
      throw new DOMException("Aborted", "AbortError")
    }

    this.subtitles = segments
    this.sourceLanguage = detectedLanguage
    this.cachedVideoId = ctx.videoId

    return this.subtitles
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  isPreSegmented(): boolean {
    return true
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    return this.createAiSubtitlesContext() !== null
  }

  async shouldUseSameTrack(): Promise<boolean> {
    if (this.subtitles.length === 0 || this.cachedVideoId === null) {
      return false
    }
    return this.createAiSubtitlesContext()?.videoId === this.cachedVideoId
  }

  cleanup(): void {
    this.subtitles = []
    this.sourceLanguage = ""
    this.cachedVideoId = null
    this.abortController?.abort()
    this.abortController = null
  }
}
