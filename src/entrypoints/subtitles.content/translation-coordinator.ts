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

function fragmentIdentity(fragment: Pick<SubtitlesFragment, "end" | "text">): string {
  return `${fragment.end}\0${fragment.text}`
}

export class TranslationCoordinator {
  private translatingStarts = new Set<number>()
  private translatedStarts = new Set<number>()
  private failedStarts = new Set<number>()
  /** Identity of the cue (end+text) associated with a booked start. */
  private knownIdentities = new Map<number, string>()
  private isTranslating = false
  /** False after stop(); blocks chained ticks and in-flight result application. */
  private active = false
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

    this.active = true

    video.addEventListener("timeupdate", this.handleTranslationTick)
    video.addEventListener("seeked", this.handleTranslationTick)

    if (this.segmentationPipeline) {
      video.addEventListener("seeked", this.handleSeek)
      this.segmentationPipeline.start()
    }

    this.handleTranslationTick()
  }

  stop() {
    this.active = false
    const video = this.getVideoElement()
    if (!video) return
    video.removeEventListener("timeupdate", this.handleTranslationTick)
    video.removeEventListener("seeked", this.handleTranslationTick)
    video.removeEventListener("seeked", this.handleSeek)
    this.segmentationPipeline?.stop()
  }

  reset() {
    this.active = false
    this.translatingStarts.clear()
    this.translatedStarts.clear()
    this.failedStarts.clear()
    this.knownIdentities.clear()
    this.isTranslating = false
    this.lastEmittedState = "idle"
    this.videoContext = { videoTitle: "", subtitlesTextContent: "" }
  }

  clearFailed() {
    this.failedStarts.clear()
  }

  /**
   * Drop bookkeeping for starts that no longer exist, or whose cue identity
   * (end+text) changed after AI re-segmentation — same start can be a recut line.
   */
  noteFragmentListChanged() {
    if (!this.active) return

    const byStart = new Map(this.getFragments().map((fragment) => [fragment.start, fragment]))

    this.invalidateStaleStarts(this.translatedStarts, byStart)
    this.invalidateStaleStarts(this.translatingStarts, byStart)
    this.invalidateStaleStarts(this.failedStarts, byStart)

    this.handleTranslationTick()
  }

  private invalidateStaleStarts(starts: Set<number>, byStart: Map<number, SubtitlesFragment>) {
    for (const start of [...starts]) {
      const current = byStart.get(start)
      if (!current) {
        starts.delete(start)
        this.knownIdentities.delete(start)
        continue
      }

      const known = this.knownIdentities.get(start)
      if (known !== undefined && known !== fragmentIdentity(current)) {
        starts.delete(start)
        this.knownIdentities.delete(start)
      }
    }
  }

  private rememberIdentity(fragment: SubtitlesFragment) {
    this.knownIdentities.set(fragment.start, fragmentIdentity(fragment))
  }

  private handleTranslationTick = () => {
    if (!this.active) return

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
    if (!this.active) return

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
    batch.forEach((f) => {
      this.translatingStarts.add(f.start)
      this.rememberIdentity(f)
    })

    try {
      const translated = await translateSubtitles(batch, this.videoContext)
      if (!this.active) {
        batch.forEach((f) => this.translatingStarts.delete(f.start))
        return
      }

      // Only accept results whose cue identity still matches the current fragment list.
      const stillValid = this.filterIdentityValid(translated)

      stillValid.forEach((f) => {
        this.translatingStarts.delete(f.start)
        this.translatedStarts.add(f.start)
        this.rememberIdentity(f)
      })
      // Starts that disappeared or were recut mid-request should not stay "translating".
      batch.forEach((f) => {
        this.translatingStarts.delete(f.start)
      })
      this.onTranslated(stillValid)

      const latestTimeMs = this.getCurrentVideoTimeMs(currentTimeMs)
      const latestFragments = this.getFragments()
      this.updateLoadingStateAt(latestTimeMs, latestFragments)
    } catch (error) {
      if (!this.active) {
        batch.forEach((f) => this.translatingStarts.delete(f.start))
        return
      }

      // Starts that disappeared or were recut mid-request should not stay "translating".
      batch.forEach((f) => {
        this.translatingStarts.delete(f.start)
      })

      // Same identity gate as the success path: never bookkeep or publish recut/stale cues.
      const stillValid = this.filterIdentityValid(batch)
      stillValid.forEach((f) => {
        this.failedStarts.add(f.start)
        this.rememberIdentity(f)
      })

      const config = await getLocalConfig()
      if (!this.active) {
        return
      }

      // Re-check after the await: AI recut may have landed while config was loading.
      const validForFallback = this.filterIdentityValid(stillValid)
      const displayMode = config?.videoSubtitles?.style.displayMode
      const fallback =
        displayMode === "translationOnly"
          ? validForFallback.map((f) => ({ ...f, translation: f.text }))
          : validForFallback.map((f) => ({ ...f, translation: "" }))
      if (fallback.length > 0) {
        this.onTranslated(fallback)
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      this.lastEmittedState = "error"
      this.onStateChange("error", { message: errorMessage })
    } finally {
      this.isTranslating = false
      // Kick the next nearby batch without waiting for the next timeupdate.
      // Guarded: stop()/reset() must not chain more translation after teardown.
      if (this.active) {
        this.handleTranslationTick()
      }
    }
  }

  private getCurrentVideoTimeMs(fallbackTimeMs: number): number {
    const video = this.getVideoElement()
    if (!video) {
      return fallbackTimeMs
    }
    return video.currentTime * 1000
  }

  /** Keep only cues whose start+end+text still match the live fragment list. */
  private filterIdentityValid(fragments: SubtitlesFragment[]): SubtitlesFragment[] {
    const byStart = new Map(this.getFragments().map((fragment) => [fragment.start, fragment]))
    return fragments.filter((fragment) => {
      const current = byStart.get(fragment.start)
      return !!current && current.end === fragment.end && current.text === fragment.text
    })
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
