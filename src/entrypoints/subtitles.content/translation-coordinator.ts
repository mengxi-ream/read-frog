import type { SegmentationPipeline } from "./segmentation-pipeline"
import type { Config } from "@/types/config/config"
import type { BatchQueueConfig } from "@/types/config/translate"
import type { SubtitlesVideoContext } from "@/utils/subtitles/processor/translator"
import type { StateData, SubtitlesFragment, SubtitlesState } from "@/utils/subtitles/types"
import { storage } from "#imports"
import { configSchema } from "@/types/config/config"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import {
  FAILED_BATCH_RETRY_MS,
  MACHINE_PLACEHOLDER_LEAD_MS,
  TRANSLATE_LOOK_AHEAD_MS,
} from "@/utils/constants/subtitles"
import { DEFAULT_BATCH_CONFIG } from "@/utils/constants/translate"
import { getBuiltInAiRefusalKind } from "@/utils/hosted-ai/refusal"
import { createLogger } from "@/utils/logging/logger"
import { isPermanentRequestError } from "@/utils/request/retry-policy"
import { effectiveLookAheadMs } from "@/utils/subtitles/lookahead"
import {
  getSubtitlesPassLimits,
  shouldUseMachinePlaceholder,
  translateSubtitles,
  translateSubtitleWithMachine,
} from "@/utils/subtitles/processor/translator"
import { adPlayingAtom, subtitlesStore } from "./atoms"

const log = createLogger("subtitles/translation-coordinator")

export interface TranslationCoordinatorOptions {
  getFragments: () => SubtitlesFragment[]
  getVideoElement: () => HTMLVideoElement | null
  getCurrentState: () => SubtitlesState
  segmentationPipeline: SegmentationPipeline | null
  onTranslated: (fragments: SubtitlesFragment[]) => void
  onStateChange: (state: SubtitlesState, data?: Omit<StateData, "state">) => void
  /** Limits for one pass (see `getSubtitlesPassLimits`); kept current from config while running. */
  batchLimits?: BatchQueueConfig
  /**
   * Whether a line about to show without its translation gets a machine one meanwhile (see
   * `shouldUseMachinePlaceholder`). Kept current from config while running.
   */
  machinePlaceholder?: boolean
  /** Translation holds: every machine translation goes, the one on screen included. */
  onMachineTranslationsDropped?: () => void
  /** Built-in AI refused a cue batch, a guest or a spent pool: translation holds (`hold`). */
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

/**
 * Every batch after would fail the same way: Built-in AI refused, or the error is one no
 * retry gets past — an access denial, a wrong key, an empty balance, no permission, a
 * wrong model (`isPermanentRequestError`).
 */
function failsEveryBatch(error: unknown): boolean {
  return getBuiltInAiRefusalKind(error) !== null || isPermanentRequestError(error)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class TranslationCoordinator {
  /** Starts sent to the provider and not back yet. */
  private translatingStarts = new Set<number>()
  private translatedStarts = new Set<number>()
  /** Starts a machine translation was asked for: once a line. */
  private machineStarts = new Set<number>()
  /** Identity of the cue (end+text) associated with a booked start. */
  private knownIdentities = new Map<number, string>()
  /**
   * Cues that failed since a batch last came back, with the error, and whether they still
   * wait out their 10 s: see `handleFailedBatch`. A batch coming back clears them all.
   */
  private failedCues = new Map<number, { error: unknown; waiting: boolean }>()
  /** Set by `hold`: nothing is sent until `retryFailed`. */
  private held = false
  /** False after stop(); blocks chained ticks and in-flight result application. */
  private active = false
  /** Bumped on stop() so in-flight batches cannot apply after stop/start. */
  private runId = 0
  private lastEmittedState: SubtitlesState = "idle"
  /** The error last shown for a failed cue: another cue's error replaces it. */
  private lastEmittedMessage: string | undefined
  private videoContext: SubtitlesVideoContext = { videoTitle: "", subtitlesTextContent: "" }
  private listenersAttached = false

  private getFragments: () => SubtitlesFragment[]
  private getVideoElement: () => HTMLVideoElement | null
  private getCurrentState: () => SubtitlesState
  private segmentationPipeline: SegmentationPipeline | null
  private onTranslated: (fragments: SubtitlesFragment[]) => void
  private onStateChange: (state: SubtitlesState, data?: Omit<StateData, "state">) => void
  private onMachineTranslationsDropped: (() => void) | undefined
  private onBuiltInAiRefused: ((error: unknown) => void) | undefined
  private batchLimits: BatchQueueConfig
  private machinePlaceholder: boolean
  private unwatchConfig: (() => void) | null = null

  constructor(options: TranslationCoordinatorOptions) {
    this.batchLimits = options.batchLimits ?? DEFAULT_BATCH_CONFIG
    this.machinePlaceholder = options.machinePlaceholder ?? false
    this.getFragments = options.getFragments
    this.getVideoElement = options.getVideoElement
    this.getCurrentState = options.getCurrentState
    this.segmentationPipeline = options.segmentationPipeline
    this.onTranslated = options.onTranslated
    this.onStateChange = options.onStateChange
    this.onMachineTranslationsDropped = options.onMachineTranslationsDropped
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
    this.watchProviderSettings()

    if (this.segmentationPipeline) {
      this.segmentationPipeline.start()
    }

    this.handleTranslationTick()
  }

  stop() {
    this.active = false
    this.runId += 1
    // What was on its way is void now (runId): a subsequent start() asks again.
    this.translatingStarts.clear()
    this.machineStarts.clear()
    this.detachVideoListeners()
    this.unwatchProviderSettings()
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
    this.unwatchProviderSettings()
    this.translatingStarts.clear()
    this.translatedStarts.clear()
    this.machineStarts.clear()
    this.knownIdentities.clear()
    this.failedCues.clear()
    this.held = false
    this.lastEmittedState = "idle"
    this.videoContext = { videoTitle: "", subtitlesTextContent: "" }
  }

  /**
   * Settings apply mid-video, as they already do for the background queue. A new provider
   * also lifts a hold, such as one on every cue Built-in AI refused: the reader may have
   * switched just for them.
   */
  private watchProviderSettings() {
    if (this.unwatchConfig) return
    this.unwatchConfig = storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (next, previous) => {
      const parsed = configSchema.safeParse(next)
      if (!parsed.success) return
      this.batchLimits = getSubtitlesPassLimits(parsed.data)
      this.machinePlaceholder = shouldUseMachinePlaceholder(parsed.data)
      if (parsed.data.videoSubtitles.providerId !== previous?.videoSubtitles?.providerId) {
        this.retryFailed()
      }
    })
  }

  private unwatchProviderSettings() {
    this.unwatchConfig?.()
    this.unwatchConfig = null
  }

  private attachVideoListeners(video: HTMLVideoElement) {
    if (this.listenersAttached) return
    video.addEventListener("timeupdate", this.handleTranslationTick)
    // As a seek starts, not only once it ends: the new place is asked for while the
    // player buffers it, instead of after.
    video.addEventListener("seeking", this.handleTranslationTick)
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
      video.removeEventListener("seeking", this.handleTranslationTick)
      video.removeEventListener("seeked", this.handleTranslationTick)
      video.removeEventListener("seeked", this.handleSeek)
    }
    globalThis.document?.removeEventListener("visibilitychange", this.handleVisibilityChange)
    this.listenersAttached = false
  }

  /**
   * Log in, Upgrade, or fixing a key all happen in another tab, and nothing tells this one
   * when the reader has done it there: coming back is the cue to try the held cues again.
   * Still failing, they hold again, and the video isn't asked about twice.
   */
  private handleVisibilityChange = () => {
    if (this.held && document.visibilityState === "visible") {
      this.retryFailed()
    }
  }

  clearFailed() {
    this.failedCues.clear()
    this.held = false
  }

  /**
   * Lifts a hold, so the cues it held go out again, as after a switch away from a provider
   * that refused; failed cues go again too, without waiting out their 10 s. Sent now rather
   * than on the next timeupdate, which a paused video never sends; the tick also takes down
   * the error the hold left up.
   */
  retryFailed() {
    this.clearFailed()
    this.requestTick()
  }

  /**
   * Drop bookkeeping for starts that no longer exist, or whose cue identity
   * (end+text) changed after AI re-segmentation — same start can be a recut line.
   */
  noteFragmentListChanged() {
    if (!this.active) return

    const byStart = new Map(this.getFragments().map((fragment) => [fragment.start, fragment]))
    for (const [start, identity] of this.knownIdentities) {
      const current = byStart.get(start)
      if (!current || fragmentIdentity(current) !== identity) {
        this.forgetStart(start)
      }
    }

    this.handleTranslationTick()
  }

  private forgetStart(start: number) {
    this.knownIdentities.delete(start)
    this.translatingStarts.delete(start)
    this.translatedStarts.delete(start)
    this.machineStarts.delete(start)
    this.failedCues.delete(start)
  }

  private rememberIdentity(fragment: SubtitlesFragment) {
    this.knownIdentities.set(fragment.start, fragmentIdentity(fragment))
  }

  private handleTranslationTick = () => {
    if (!this.active) return
    // Ad timeline can freeze or jump; do not translate against main-video cues mid-ad.
    if (subtitlesStore.get(adPlayingAtom)) return
    // Nothing goes out, and the error stays up, until the reader retries.
    if (this.held) return

    const video = this.getVideoElement()
    if (!video) return

    const currentTimeMs = video.currentTime * 1000
    const fragments = this.getFragments()

    this.updateLoadingStateAt(currentTimeMs, fragments)

    if (
      this.segmentationPipeline &&
      !this.segmentationPipeline.isRunning &&
      this.segmentationPipeline.hasUnprocessedChunks()
    ) {
      this.segmentationPipeline.restart()
    }

    this.sendNearbyBatches(currentTimeMs, fragments, video.playbackRate)
    if (this.machinePlaceholder) {
      this.sendMachineTranslations(currentTimeMs, fragments, video.playbackRate)
    }
  }

  /**
   * Every untranslated cue in the look-ahead window goes now, in full batches, and the
   * queue paces them: after a seek the new place is asked for at once, whatever the old
   * one still waits on. The window decides when to request, not how much — a batch takes
   * the cues after the window too, as topping up only the cues that just scrolled into it
   * sent one line per request during playback. A failed cue waits out its 10 s first.
   */
  private sendNearbyBatches(
    currentTimeMs: number,
    fragments: SubtitlesFragment[],
    playbackRate: number | undefined,
  ) {
    const windowEndMs = currentTimeMs + effectiveLookAheadMs(TRANSLATE_LOOK_AHEAD_MS, playbackRate)
    const pending = fragments.filter(
      (f) =>
        !this.translatedStarts.has(f.start) &&
        !this.translatingStarts.has(f.start) &&
        !this.failedCues.get(f.start)?.waiting &&
        f.start >= currentTimeMs - 5000,
    )

    while (pending.length > 0 && pending[0]!.start <= windowEndMs) {
      const batch = takeBatch(pending, this.batchLimits)
      pending.splice(0, batch.length)
      void this.translateBatch(batch)
    }
  }

  private async translateBatch(batch: SubtitlesFragment[]) {
    const runId = this.runId
    batch.forEach((f) => {
      this.translatingStarts.add(f.start)
      this.rememberIdentity(f)
    })

    try {
      const failures: { lines: SubtitlesFragment[]; error: Error }[] = []
      const translated = await translateSubtitles(
        batch,
        this.videoContext,
        undefined,
        (lines, error) => {
          failures.push({ lines, error })
        },
      )
      if (!this.isCurrentRun(runId)) return

      // The provider works: the failed cues go again at once (the tick below).
      this.failedCues.clear()
      // Only accept results whose cue identity still matches the current fragment list.
      const failedStarts = new Set(failures.flatMap(({ lines }) => lines.map((f) => f.start)))
      const stillValid = this.filterIdentityValid(translated).filter(
        (f) => !failedStarts.has(f.start),
      )
      stillValid.forEach((f) => this.translatedStarts.add(f.start))
      this.onTranslated(stillValid)
      // Lines that failed while the rest came back have failed all the same.
      failures.forEach(({ lines, error }) => this.handleFailedBatch(lines, error))
    } catch (error) {
      if (!this.isCurrentRun(runId)) return
      this.handleFailedBatch(batch, error)
    } finally {
      // Only the current generation may touch the bookkeeping or chain another tick.
      if (this.isCurrentRun(runId)) {
        this.releaseBatch(batch)
        // Sooner than the next timeupdate, which a paused video never sends: the cue on
        // screen may be resolved now, or have failed, and after a batch that came back, the
        // failed cues go again.
        this.requestTick()
      }
    }
  }

  /**
   * A failed batch's cues go again 10 s on, or as soon as another batch comes back, so a
   * provider that is down is asked every 10 s rather than in a loop. Meanwhile a failed cue
   * on screen shows the error in place of the captions (`updateLoadingStateAt`), and a batch
   * coming back takes it down. An error every batch after would repeat holds translation at
   * once instead (`hold`).
   */
  private handleFailedBatch(batch: SubtitlesFragment[], error: unknown) {
    if (failsEveryBatch(error)) {
      if (!this.held) {
        this.hold(error)
      }
      return
    }
    // A cue recut while its batch was out is a new one, with nothing failed yet.
    const failures = this.filterIdentityValid(batch).map((f) => {
      const failure = { error, waiting: true }
      this.failedCues.set(f.start, failure)
      return failure
    })
    // The timer ends the wait, and the next pass sends them, even if the video is paused by
    // then. Not the clock: a timer can fire a little ahead of it, and none would come after.
    setTimeout(() => {
      for (const failure of failures) {
        failure.waiting = false
      }
      this.requestTick()
    }, FAILED_BATCH_RETRY_MS)
  }

  /**
   * An error every batch after would repeat, such as a spent balance or a wrong key: machine
   * translations would cover it up for as long as the video plays. So nothing is sent until
   * the reader retries — back to the tab, or another provider — the machine translations go
   * at once, and the error stays up in place of the captions. The AI's lines are kept for
   * when translation goes on.
   */
  private hold(error: unknown) {
    this.held = true
    this.machineStarts.clear()
    this.onMachineTranslationsDropped?.()
    this.lastEmittedState = "error"
    this.lastEmittedMessage = errorMessage(error)
    this.onStateChange("error", { message: this.lastEmittedMessage, persistent: true })
    if (getBuiltInAiRefusalKind(error)) {
      this.onBuiltInAiRefused?.(error)
    }
  }

  /**
   * A cue on screen, or about to be, without its translation gets a machine one meanwhile:
   * once a cue, and only filling the gap — the AI's replaces it (see the scheduler).
   */
  private sendMachineTranslations(
    currentTimeMs: number,
    fragments: SubtitlesFragment[],
    playbackRate: number | undefined,
  ) {
    const leadEndMs =
      currentTimeMs + effectiveLookAheadMs(MACHINE_PLACEHOLDER_LEAD_MS, playbackRate)
    for (const fragment of fragments) {
      if (fragment.start > leadEndMs) break
      if (
        fragment.end <= currentTimeMs ||
        this.translatedStarts.has(fragment.start) ||
        this.machineStarts.has(fragment.start)
      ) {
        continue
      }
      this.machineStarts.add(fragment.start)
      this.rememberIdentity(fragment)
      void this.translateWithMachine(fragment)
    }
  }

  private async translateWithMachine(fragment: SubtitlesFragment) {
    const runId = this.runId
    let translation: string
    try {
      translation = await translateSubtitleWithMachine(fragment.text)
    } catch (error) {
      // The cue waits for the AI's translation instead.
      log.debug("Machine translation failed", { error })
      return
    }
    // Late for a hold, which took the machine translations down, or for a recut cue.
    if (!this.isCurrentRun(runId) || this.held || !translation) return
    if (this.filterIdentityValid([fragment]).length === 0) return
    this.onTranslated([{ ...fragment, translation, placeholder: "machine" }])
  }

  /** Unbooks the batch's cues, unless a recut booked their start for another cue meanwhile. */
  private releaseBatch(batch: SubtitlesFragment[]) {
    for (const fragment of batch) {
      if (this.knownIdentities.get(fragment.start) === fragmentIdentity(fragment)) {
        this.translatingStarts.delete(fragment.start)
      }
    }
  }

  private isCurrentRun(runId: number): boolean {
    return this.active && runId === this.runId
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
    return this.held || this.translatedStarts.has(startMs)
  }

  private updateLoadingStateAt(timeMs: number, fragments: SubtitlesFragment[]) {
    const activeCue = this.findActiveCue(timeMs, fragments)

    // A failed cue shows the error until a batch comes back. Between two cues, the next one
    // decides, so the error does not flicker off and on at every gap.
    const cue = activeCue ?? fragments.find((f) => f.start > timeMs)
    const failure =
      cue && !this.isCueResolved(cue.start) ? this.failedCues.get(cue.start) : undefined
    if (failure) {
      const message = errorMessage(failure.error)
      if (this.lastEmittedState === "error" && this.lastEmittedMessage === message) return
      this.lastEmittedState = "error"
      this.lastEmittedMessage = message
      this.onStateChange("error", { message, persistent: true })
      return
    }

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
