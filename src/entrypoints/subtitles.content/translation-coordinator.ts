import type { SegmentationPipeline } from "./segmentation-pipeline"
import type { SubtitlesVideoContext } from "@/utils/subtitles/processor/translator"
import type { SubtitlesFragment, SubtitlesState } from "@/utils/subtitles/types"
import { getLocalConfig } from "@/utils/config/storage"
import { TRANSLATE_LOOK_AHEAD_MS, TRANSLATION_BATCH_SIZE } from "@/utils/constants/subtitles"
import { translateSubtitles } from "@/utils/subtitles/processor/translator"

export interface TranslationCoordinatorOptions {
  getFragments: () => SubtitlesFragment[]
  getVideoElement: () => HTMLVideoElement | null
  getCurrentState: () => SubtitlesState
  segmentationPipeline: SegmentationPipeline | null
  onTranslated: (fragments: SubtitlesFragment[]) => void
  onStateChange: (state: SubtitlesState, data?: Record<string, string>) => void
}

export class TranslationCoordinator {
  private translatingStarts = new Set<number>()
  private translatedStarts = new Set<number>()
  private failedStarts = new Set<number>()
  private isTranslating = false
  private lastEmittedState: SubtitlesState = "idle"
  private videoContext: SubtitlesVideoContext = { videoTitle: "", subtitlesTextContent: "" }

  private getFragments: () => SubtitlesFragment[]
  private getVideoElement: () => HTMLVideoElement | null
  private getCurrentState: () => SubtitlesState
  private segmentationPipeline: SegmentationPipeline | null
  private onTranslated: (fragments: SubtitlesFragment[]) => void
  private onStateChange: (state: SubtitlesState, data?: Record<string, string>) => void

  constructor(options: TranslationCoordinatorOptions) {
    this.getFragments = options.getFragments
    this.getVideoElement = options.getVideoElement
    this.getCurrentState = options.getCurrentState
    this.segmentationPipeline = options.segmentationPipeline
    this.onTranslated = options.onTranslated
    this.onStateChange = options.onStateChange
  }

  start(videoContext?: SubtitlesVideoContext) {
    if (videoContext !== undefined) {
      this.videoContext = videoContext
    }

    const video = this.getVideoElement()
    if (!video) return

    video.addEventListener("timeupdate", this.handleTranslationTick)
    video.addEventListener("seeked", this.handleTranslationTick)

    if (this.segmentationPipeline) {
      video.addEventListener("seeked", this.handleSeek)
      this.segmentationPipeline.start()
    }

    this.handleTranslationTick()
  }

  stop() {
    const video = this.getVideoElement()
    if (!video) return
    video.removeEventListener("timeupdate", this.handleTranslationTick)
    video.removeEventListener("seeked", this.handleTranslationTick)
    video.removeEventListener("seeked", this.handleSeek)
    this.segmentationPipeline?.stop()
  }

  reset() {
    this.translatingStarts.clear()
    this.translatedStarts.clear()
    this.failedStarts.clear()
    this.isTranslating = false
    this.lastEmittedState = "idle"
    this.videoContext = { videoTitle: "", subtitlesTextContent: "" }
  }

  clearFailed() {
    this.failedStarts.clear()
  }

  /**
   * Drop bookkeeping for starts that no longer exist after AI re-segmentation,
   * then re-evaluate nearby translation.
   */
  noteFragmentListChanged() {
    const validStarts = new Set(this.getFragments().map((fragment) => fragment.start))

    for (const start of [...this.translatedStarts]) {
      if (!validStarts.has(start)) {
        this.translatedStarts.delete(start)
      }
    }
    for (const start of [...this.translatingStarts]) {
      if (!validStarts.has(start)) {
        this.translatingStarts.delete(start)
      }
    }
    for (const start of [...this.failedStarts]) {
      if (!validStarts.has(start)) {
        this.failedStarts.delete(start)
      }
    }

    this.handleTranslationTick()
  }

  private handleTranslationTick = () => {
    const video = this.getVideoElement()
    if (!video) return

    const currentTimeMs = video.currentTime * 1000
    const fragments = this.getFragments()

    if (this.getCurrentState() === "error") return

    this.updateLoadingStateAt(currentTimeMs, fragments)

    if (
      this.segmentationPipeline &&
      !this.segmentationPipeline.isRunning &&
      this.segmentationPipeline.hasUnprocessedChunks()
    ) {
      this.segmentationPipeline.restart()
    }

    if (this.isTranslating) return
    void this.translateNearby(currentTimeMs)
  }

  private async translateNearby(currentTimeMs: number) {
    const fragments = this.getFragments()

    const batch = fragments
      .filter(
        (f) =>
          !this.translatedStarts.has(f.start) &&
          !this.translatingStarts.has(f.start) &&
          !this.failedStarts.has(f.start) &&
          f.start >= currentTimeMs - 5000 &&
          f.start <= currentTimeMs + TRANSLATE_LOOK_AHEAD_MS,
      )
      .slice(0, TRANSLATION_BATCH_SIZE)

    if (batch.length === 0) {
      return
    }

    this.isTranslating = true
    batch.forEach((f) => this.translatingStarts.add(f.start))

    try {
      const translated = await translateSubtitles(batch, this.videoContext)
      // Drop results for starts removed by AI re-segmentation while the request was in flight.
      const validStarts = new Set(this.getFragments().map((fragment) => fragment.start))
      const stillValid = translated.filter((fragment) => validStarts.has(fragment.start))

      stillValid.forEach((f) => {
        this.translatingStarts.delete(f.start)
        this.translatedStarts.add(f.start)
      })
      // Starts that disappeared mid-request should not stay "translating" forever.
      batch.forEach((f) => {
        this.translatingStarts.delete(f.start)
      })
      this.onTranslated(stillValid)

      const latestTimeMs = this.getCurrentVideoTimeMs(currentTimeMs)
      const latestFragments = this.getFragments()
      this.updateLoadingStateAt(latestTimeMs, latestFragments)
    } catch (error) {
      batch.forEach((f) => {
        this.translatingStarts.delete(f.start)
        this.failedStarts.add(f.start)
      })

      const config = await getLocalConfig()
      const displayMode = config?.videoSubtitles?.style.displayMode
      const fallback =
        displayMode === "translationOnly"
          ? batch.map((f) => ({ ...f, translation: f.text }))
          : batch.map((f) => ({ ...f, translation: "" }))
      this.onTranslated(fallback)

      const errorMessage = error instanceof Error ? error.message : String(error)
      this.lastEmittedState = "error"
      this.onStateChange("error", { message: errorMessage })
    } finally {
      this.isTranslating = false
      // Kick the next nearby batch without waiting for the next timeupdate.
      this.handleTranslationTick()
    }
  }

  private getCurrentVideoTimeMs(fallbackTimeMs: number): number {
    const video = this.getVideoElement()
    if (!video) {
      return fallbackTimeMs
    }
    return video.currentTime * 1000
  }

  private findActiveCue(timeMs: number, fragments: SubtitlesFragment[]): SubtitlesFragment | null {
    return fragments.find((f) => f.start <= timeMs && f.end > timeMs) ?? null
  }

  private isCueResolved(startMs: number): boolean {
    return this.translatedStarts.has(startMs) || this.failedStarts.has(startMs)
  }

  private updateLoadingStateAt(timeMs: number, fragments: SubtitlesFragment[]) {
    const activeCue = this.findActiveCue(timeMs, fragments)

    if (activeCue) {
      const nextState: SubtitlesState = this.isCueResolved(activeCue.start) ? "idle" : "loading"
      if (nextState === this.lastEmittedState) return
      this.lastEmittedState = nextState
      this.onStateChange(nextState)
      return
    }

    // Gap / music intro / before first cue: never keep the corner loading badge up.
    // Adapter may have set "loading" before fragments were ready; lastEmittedState can
    // still be "idle" while the scheduler state remains "loading" — always clear it.
    if (this.lastEmittedState === "idle" && this.getCurrentState() !== "loading") {
      return
    }
    this.lastEmittedState = "idle"
    this.onStateChange("idle")
  }

  private handleSeek = () => {
    this.segmentationPipeline?.restart()
  }
}
