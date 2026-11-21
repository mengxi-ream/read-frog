import type { SegmentationPipeline } from "./segmentation-pipeline"
import type { Config } from "@/types/config/config"
import type { BatchQueueConfig } from "@/types/config/translate"
import type { SubtitlesVideoContext } from "@/utils/subtitles/processor/translator"
import type { SubtitlesFragment, SubtitlesState } from "@/utils/subtitles/types"
import { storage } from "#imports"
import { configSchema } from "@/types/config/config"
import { getLocalConfig } from "@/utils/config/storage"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { TRANSLATE_LOOK_AHEAD_MS } from "@/utils/constants/subtitles"
import { DEFAULT_BATCH_CONFIG } from "@/utils/constants/translate"
import { getBuiltInAiRefusalKind } from "@/utils/hosted-ai/refusal"
import { effectiveLookAheadMs } from "@/utils/subtitles/lookahead"
import { getSubtitlesPassLimits, translateSubtitles } from "@/utils/subtitles/processor/translator"
import { adPlayingAtom, subtitlesStore } from "./atoms"

export interface TranslationCoordinatorOptions {
  getFragments: () => SubtitlesFragment[]
  getVideoElement: () => HTMLVideoElement | null
  getCurrentState: () => SubtitlesState
  segmentationPipeline: SegmentationPipeline | null
  onTranslated: (fragments: SubtitlesFragment[]) => void
  onStateChange: (state: SubtitlesState, data?: Record<string, string>) => void
  /** Limits for one pass (see `getSubtitlesPassLimits`); kept current from config while running. */
  batchLimits?: BatchQueueConfig
  /**
   * Built-in AI refused a cue batch: a guest, or a spent pool. Every batch after it would
   * be refused the same way, so translation holds until `retryFailed`, a provider change,
   * or the reader coming back to the tab.
   */
  onBuiltInAiRefused?: (error: unknown) => void
}

function fragmentIdentity(fragment: Pick<SubtitlesFragment, "end" | "text">): string {
  return `${fragment.end}\0${fragment.text}`
}

/** Leading cues that fit the limits; always at least one, so an oversized cue still goes. */
function takeBatch(pending: SubtitlesFragment[], limits: BatchQueueConfig): SubtitlesFragment[] {
  const batch: SubtitlesFragment[] = []
  let characters = 0
  for (const fragment of pending) {
    if (batch.length >= limits.maxItemsPerBatch) break
    if (batch.length > 0 && characters + fragment.text.length > limits.maxCharactersPerBatch) break
    batch.push(fragment)
    characters += fragment.text.length
  }
  return batch
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
  /** Bumped on stop() so in-flight batches cannot apply after stop/start. */
  private runId = 0
  private lastEmittedState: SubtitlesState = "idle"
  private videoContext: SubtitlesVideoContext = { videoTitle: "", subtitlesTextContent: "" }
  private listenersAttached = false

  private getFragments: () => SubtitlesFragment[]
  private getVideoElement: () => HTMLVideoElement | null
  private getCurrentState: () => SubtitlesState
  private segmentationPipeline: SegmentationPipeline | null
  private onTranslated: (fragments: SubtitlesFragment[]) => void
  private onStateChange: (state: SubtitlesState, data?: Record<string, string>) => void
  private onBuiltInAiRefused: ((error: unknown) => void) | undefined
  private batchLimits: BatchQueueConfig
  private unwatchConfig: (() => void) | null = null
  /** Set when Built-in AI refuses a batch; see `onBuiltInAiRefused`. */
  private heldByRefusal = false

  constructor(options: TranslationCoordinatorOptions) {
    this.batchLimits = options.batchLimits ?? DEFAULT_BATCH_CONFIG
    this.getFragments = options.getFragments
    this.getVideoElement = options.getVideoElement
    this.getCurrentState = options.getCurrentState
    this.segmentationPipeline = options.segmentationPipeline
    this.onTranslated = options.onTranslated
    this.onStateChange = options.onStateChange
    this.onBuiltInAiRefused = options.onBuiltInAiRefused
  }

  start(videoContext?: SubtitlesVideoContext) {
    if (videoContext !== undefined) {
      this.videoContext = videoContext
    }

    const video = this.getVideoElement()
    if (!video) return

    this.active = true
    this.attachVideoListeners(video)
    this.watchPassLimits()

    if (this.segmentationPipeline) {
      this.segmentationPipeline.start()
    }

    this.handleTranslationTick()
  }

  stop() {
    this.active = false
    this.runId += 1
    // Allow a subsequent start() to translate immediately; the in-flight batch is
    // invalidated by runId and must not leave locks stuck.
    this.isTranslating = false
    this.translatingStarts.clear()
    this.detachVideoListeners()
    this.unwatchPassLimits()
    this.segmentationPipeline?.stop()
  }

  /** Kick a nearby pass without waiting for the next timeupdate (e.g. after an ad). */
  requestTick() {
    if (!this.active) return
    this.handleTranslationTick()
  }

  reset() {
    this.active = false
    this.runId += 1
    this.detachVideoListeners()
    this.unwatchPassLimits()
    this.translatingStarts.clear()
    this.translatedStarts.clear()
    this.failedStarts.clear()
    this.knownIdentities.clear()
    this.heldByRefusal = false
    this.isTranslating = false
    this.lastEmittedState = "idle"
    this.videoContext = { videoTitle: "", subtitlesTextContent: "" }
  }

  /**
   * Settings apply mid-video, as they already do for the background queue. A new provider
   * also gets another go at the cues the old one failed, such as every cue Built-in AI
   * refused: the reader may have switched just for them.
   */
  private watchPassLimits() {
    if (this.unwatchConfig) return
    this.unwatchConfig = storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (next, previous) => {
      const parsed = configSchema.safeParse(next)
      if (!parsed.success) return
      this.batchLimits = getSubtitlesPassLimits(parsed.data)
      if (parsed.data.videoSubtitles.providerId !== previous?.videoSubtitles?.providerId) {
        this.retryFailed()
      }
    })
  }

  private unwatchPassLimits() {
    this.unwatchConfig?.()
    this.unwatchConfig = null
  }

  private attachVideoListeners(video: HTMLVideoElement) {
    if (this.listenersAttached) return
    video.addEventListener("timeupdate", this.handleTranslationTick)
    video.addEventListener("seeked", this.handleTranslationTick)
    if (this.segmentationPipeline) {
      video.addEventListener("seeked", this.handleSeek)
    }
    globalThis.document?.addEventListener("visibilitychange", this.handleVisibilityChange)
    this.listenersAttached = true
  }

  private detachVideoListeners() {
    if (!this.listenersAttached) return
    const video = this.getVideoElement()
    if (video) {
      video.removeEventListener("timeupdate", this.handleTranslationTick)
      video.removeEventListener("seeked", this.handleTranslationTick)
      video.removeEventListener("seeked", this.handleSeek)
    }
    globalThis.document?.removeEventListener("visibilitychange", this.handleVisibilityChange)
    this.listenersAttached = false
  }

  /**
   * Log in and Upgrade open the website in another tab, and nothing tells this one when
   * the reader has done either there: coming back is the cue to try the held cues again.
   * Still refused, they hold again, and the video isn't asked about twice.
   */
  private handleVisibilityChange = () => {
    if (this.heldByRefusal && document.visibilityState === "visible") {
      this.retryFailed()
    }
  }

  clearFailed() {
    this.failedStarts.clear()
    this.heldByRefusal = false
  }

  /** Translates the failed cues again, as after a switch away from a provider that refused. */
  retryFailed() {
    this.clearFailed()
    // The failure's error badge stops every tick until it hides, 5 s on: a switch made
    // straight from the prompt would otherwise wait that out, or on a paused video, until
    // the reader plays or seeks.
    if (this.active && this.getCurrentState() === "error") {
      this.lastEmittedState = "idle"
      this.onStateChange("idle")
    }
    this.requestTick()
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
    // Ad timeline can freeze or jump; do not translate against main-video cues mid-ad.
    if (subtitlesStore.get(adPlayingAtom)) return

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
    if (!this.active || this.heldByRefusal) return

    const fragments = this.getFragments()

    const lookAheadMs = effectiveLookAheadMs(
      TRANSLATE_LOOK_AHEAD_MS,
      this.getVideoElement()?.playbackRate,
    )

    const pending = fragments.filter(
      (f) =>
        !this.translatedStarts.has(f.start) &&
        !this.translatingStarts.has(f.start) &&
        !this.failedStarts.has(f.start) &&
        f.start >= currentTimeMs - 5000,
    )

    // The window decides when to request, not how much: topping up only the cues
    // that just scrolled into it sent one line per request during playback.
    if (!pending.some((f) => f.start <= currentTimeMs + lookAheadMs)) {
      return
    }
    const batch = takeBatch(pending, this.batchLimits)

    const runId = this.runId
    this.isTranslating = true
    batch.forEach((f) => {
      this.translatingStarts.add(f.start)
      this.rememberIdentity(f)
    })

    try {
      const translated = await translateSubtitles(batch, this.videoContext)
      if (!this.active || runId !== this.runId) {
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
      if (!this.active || runId !== this.runId) {
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

      if (getBuiltInAiRefusalKind(error)) {
        this.heldByRefusal = true
        this.onBuiltInAiRefused?.(error)
      }

      const config = await getLocalConfig()
      if (!this.active || runId !== this.runId) {
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
      // Only the current generation may clear the lock / chain another tick.
      if (runId === this.runId) {
        this.isTranslating = false
        if (this.active) {
          this.handleTranslationTick()
        }
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
    // While held, no cue is on its way: none of them is loading.
    return (
      this.heldByRefusal || this.translatedStarts.has(startMs) || this.failedStarts.has(startMs)
    )
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
