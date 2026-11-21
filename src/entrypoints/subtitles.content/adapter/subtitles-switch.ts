import type { AdapterContext } from "./adapter-context"
import type { NativeCaptions } from "./native-captions"
import type { SourceSubtitlesCache } from "./source-subtitles-cache"
import type { SubtitlesSession } from "./subtitles-session"
import type { SubtitlesStarter, SubtitlesStartOptions } from "./subtitles-starter"
import type { SubtitlesSource } from "@/utils/constants/subtitles"
import type { SubtitlesFetcher } from "@/utils/subtitles/fetchers/types"
import { SUBTITLES_SOURCE } from "@/utils/constants/subtitles"
import { sourceTrackAtom, subtitlesSourceAtom, subtitlesStore, translatedTrackAtom } from "../atoms"
import { getLoadingMessage } from "./subtitles-starter"

export type SubtitlesFetcherFactories = {
  native: () => SubtitlesFetcher
  ai?: () => SubtitlesFetcher
}

type SubtitlesSwitchDeps = Pick<AdapterContext, "lifecycle" | "getScheduler"> & {
  fetchers: SubtitlesFetcherFactories
  nativeCaptions: Pick<NativeCaptions, "showNativeSubtitles" | "hideNativeSubtitles">
  sourceCache: Pick<
    SourceSubtitlesCache,
    "getOrLoadSourceSubtitles" | "clearSourceCache" | "sourceProcessedSubtitles"
  >
  session: Pick<
    SubtitlesSession,
    "clearRuntimeSession" | "publishSourceTrack" | "translationCoordinator"
  >
  hasPendingNavigationReset: () => boolean
  startTranslation: SubtitlesStarter["startTranslation"]
}

export class SubtitlesSwitch {
  private readonly lifecycle: SubtitlesSwitchDeps["lifecycle"]
  private readonly getScheduler: SubtitlesSwitchDeps["getScheduler"]
  private readonly fetchers: SubtitlesSwitchDeps["fetchers"]
  private readonly nativeCaptions: SubtitlesSwitchDeps["nativeCaptions"]
  private readonly sourceCache: SubtitlesSwitchDeps["sourceCache"]
  private readonly session: SubtitlesSwitchDeps["session"]
  private readonly hasPendingNavigationReset: SubtitlesSwitchDeps["hasPendingNavigationReset"]
  private readonly startTranslation: SubtitlesSwitchDeps["startTranslation"]
  source: SubtitlesSource = SUBTITLES_SOURCE.NATIVE
  fetcher: SubtitlesFetcher
  // Dropped by a newer start, a navigation reset or a leave; it may wait on a start that hangs.
  private trackChangeRefreshPromise: Promise<void> | null = null
  private pendingTranscriptLoads = 0
  // The start a switch is running: a track check waits for the track it loads.
  private pendingStart: Promise<boolean> | null = null

  get supportsAiSubtitles(): boolean {
    return !!this.fetchers.ai
  }

  constructor({
    lifecycle,
    getScheduler,
    fetchers,
    nativeCaptions,
    sourceCache,
    session,
    hasPendingNavigationReset,
    startTranslation,
  }: SubtitlesSwitchDeps) {
    this.lifecycle = lifecycle
    this.getScheduler = getScheduler
    this.fetchers = fetchers
    this.nativeCaptions = nativeCaptions
    this.sourceCache = sourceCache
    this.session = session
    this.hasPendingNavigationReset = hasPendingNavigationReset
    this.startTranslation = startTranslation
    this.fetcher = fetchers.native()
  }

  async handleSourceTrackChanged(): Promise<void> {
    // A navigation that has not reset yet loads the new video's track itself.
    if (this.lifecycle.destroyed || this.hasPendingNavigationReset()) return
    if (!this.trackChangeRefreshPromise) {
      const refresh = this.refreshSourceTrackIfNeeded().finally(() => {
        if (this.trackChangeRefreshPromise === refresh) this.trackChangeRefreshPromise = null
      })
      this.trackChangeRefreshPromise = refresh
    }

    await this.trackChangeRefreshPromise
  }

  /**
   * The transcript reads `sourceTrackAtom`, which only fills once a subtitles
   * session starts. Publishing it here does not put captions on the video:
   * rendering is gated on `subtitlesVisibleAtom`, which only the scheduler sets.
   */
  ensureSourceTrackPublished = async () => {
    if (subtitlesStore.get(sourceTrackAtom).length > 0) {
      return
    }
    const operationId = this.lifecycle.switchGeneration.current()
    this.pendingTranscriptLoads++
    try {
      await this.sourceCache.getOrLoadSourceSubtitles()
    } finally {
      this.pendingTranscriptLoads--
    }

    if (!this.lifecycle.switchGeneration.isCurrent(operationId)) {
      return
    }
    this.session.publishSourceTrack(this.sourceCache.sourceProcessedSubtitles)
  }

  handleToggleSubtitles(enabled: boolean, options: SubtitlesStartOptions = {}) {
    if (enabled) {
      void this.switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE, options)
    } else {
      this.getScheduler()?.hide()
      this.nativeCaptions.showNativeSubtitles()
      this.session.translationCoordinator?.stop()
      // Nothing waits on a start the reader turned off: it may never settle.
      this.pendingStart = null
      this.trackChangeRefreshPromise = null
    }
  }

  async switchSubtitlesFetcher(
    next: SubtitlesSource,
    options: SubtitlesStartOptions = {},
  ): Promise<void> {
    const make = this.fetchers[next]
    if (!make || this.lifecycle.destroyed) {
      return
    }

    const operationId = this.lifecycle.switchGeneration.next()
    this.trackChangeRefreshPromise = null

    if (next !== this.source) {
      this.fetcher.cleanup()
      this.source = next
      subtitlesStore.set(subtitlesSourceAtom, next)
      this.fetcher = make()
      this.sourceCache.clearSourceCache()
      this.session.clearRuntimeSession()
    }

    // Showing first would flash the toggle ON on every captionless video.
    if (options.quiet) {
      // Nobody asked for an automatic start, so one that cannot reach the video stays quiet too.
      const hasSubtitles = await this.fetcher.hasAvailableSubtitles().catch(() => false)
      // The check can wait seconds for cues; a toggle or a navigation since then starts its own.
      if (this.lifecycle.isSuperseded(operationId) || this.hasPendingNavigationReset()) return
      if (!hasSubtitles) {
        this.handleToggleSubtitles(false)
        return
      }
    }

    this.getScheduler()?.start()
    this.getScheduler()?.show()
    this.nativeCaptions.hideNativeSubtitles()

    const message = getLoadingMessage(next)
    if (message) {
      this.getScheduler()?.setState("loading", { message })
    }

    const start = this.startTranslation(options)
    this.pendingStart = start
    const succeeded = await start
    if (this.pendingStart === start) this.pendingStart = null
    if (!this.lifecycle.switchGeneration.isCurrent(operationId)) {
      return
    }
    if (!succeeded && next !== SUBTITLES_SOURCE.NATIVE) {
      this.revertToNativeSource()
    }
  }

  private revertToNativeSource() {
    // A track check that waited on the failed start would lay a session over the native captions.
    this.lifecycle.switchGeneration.next()
    this.fetcher.cleanup()
    this.source = SUBTITLES_SOURCE.NATIVE
    this.fetcher = this.fetchers.native()
    subtitlesStore.set(subtitlesSourceAtom, SUBTITLES_SOURCE.NATIVE)
    this.sourceCache.clearSourceCache()
    this.session.clearRuntimeSession()
    this.nativeCaptions.showNativeSubtitles()
  }

  private async refreshSourceTrackIfNeeded(): Promise<void> {
    const checkOperationId = this.lifecycle.switchGeneration.current()
    // A newer start, navigation reset or leave loads the current track itself, so this check stops.
    const isOvertaken = () =>
      this.lifecycle.isSuperseded(checkOperationId) || this.hasPendingNavigationReset()
    // A running start loads the current track, so a switch is checked against what it loaded.
    while (this.pendingStart && !isOvertaken()) await this.pendingStart
    if (isOvertaken()) return

    const scheduler = this.getScheduler()
    const isSchedulerActive = !!scheduler?.isActive()

    const isTranscriptInUse =
      subtitlesStore.get(sourceTrackAtom).length > 0 || this.pendingTranscriptLoads > 0
    if (!isSchedulerActive && !isTranscriptInUse) {
      return
    }

    const useSameTrack = await this.fetcher.shouldUseSameTrack()
    if (useSameTrack || isOvertaken()) return

    if (!scheduler || !isSchedulerActive) {
      const operationId = this.lifecycle.switchGeneration.next()
      this.session.clearRuntimeSession()
      this.sourceCache.clearSourceCache()
      this.fetcher.cleanup()
      scheduler?.reset()
      subtitlesStore.set(translatedTrackAtom, [])
      await this.sourceCache.getOrLoadSourceSubtitles()
      if (!this.lifecycle.switchGeneration.isCurrent(operationId)) {
        return
      }
      this.session.publishSourceTrack(this.sourceCache.sourceProcessedSubtitles)
      return
    }

    this.session.clearRuntimeSession()
    this.sourceCache.clearSourceCache()
    this.fetcher.cleanup()
    scheduler.reset()
    scheduler.setState("loading")

    await this.startTranslation()
  }

  dropPendingStart() {
    this.pendingStart = null
  }

  dropTrackChangeRefresh() {
    this.trackChangeRefreshPromise = null
  }

  releaseFetcher() {
    this.fetcher.cleanup()
    this.source = SUBTITLES_SOURCE.NATIVE
    subtitlesStore.set(subtitlesSourceAtom, SUBTITLES_SOURCE.NATIVE)
  }

  resetToNativeFetcher() {
    this.fetcher.cleanup()
    // A pending old fetch may still mutate its own cache after cleanup.
    this.source = SUBTITLES_SOURCE.NATIVE
    this.fetcher = this.fetchers.native()
    subtitlesStore.set(subtitlesSourceAtom, SUBTITLES_SOURCE.NATIVE)
  }
}
