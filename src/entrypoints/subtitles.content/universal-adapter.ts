import type { AdapterContext } from "./adapter/adapter-context"
import type { SubtitlesProvidersAdapter } from "./adapter/subtitles-providers-adapter"
import type { SubtitlesFetcherFactories } from "./adapter/subtitles-switch"
import type { ControlsConfig, PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import type { Config } from "@/types/config/config"
import { VIDEO_SUMMARY_QUERY_SCOPE } from "@/utils/subtitles/video-summary"
import { queryClient } from "@/utils/tanstack-query"
import { AdPlaybackWatch } from "./adapter/ad-playback-watch"
import { AdapterLifecycle } from "./adapter/adapter-context"
import { NativeCaptions } from "./adapter/native-captions"
import { NavigationWatch } from "./adapter/navigation-watch"
import { PlayerAttachment } from "./adapter/player-attachment"
import { SourceSubtitlesCache } from "./adapter/source-subtitles-cache"
import { SubtitlesSession } from "./adapter/subtitles-session"
import { SubtitlesStartRequests } from "./adapter/subtitles-start-requests"
import { SubtitlesStarter } from "./adapter/subtitles-starter"
import { SubtitlesSwitch } from "./adapter/subtitles-switch"
import { VideoSummaryStream } from "./adapter/video-summary-stream"
import {
  subtitlesSettingsPanelOpenAtom,
  subtitlesSettingsPanelViewAtom,
  subtitlesStore,
  subtitlesVisibleAtom,
  translatedTrackAtom,
} from "./atoms"
import { TranslatedSubtitlesDownloader } from "./translated-subtitles-downloader"
import { ROOT_VIEW } from "./ui/subtitles-settings-panel/views"

export class UniversalVideoAdapter implements SubtitlesProvidersAdapter {
  private config: PlatformConfig
  private readonly lifecycle = new AdapterLifecycle()
  private translatedSubtitlesDownloader: TranslatedSubtitlesDownloader | null = null
  private readonly player: PlayerAttachment
  private readonly nativeCaptions: NativeCaptions
  private readonly sourceCache: SourceSubtitlesCache
  private readonly session: SubtitlesSession
  private readonly subtitlesSwitch: SubtitlesSwitch
  private readonly starter: SubtitlesStarter
  private readonly startRequests: SubtitlesStartRequests
  private readonly adWatch: AdPlaybackWatch
  private readonly navigation: NavigationWatch
  private readonly videoSummary: VideoSummaryStream

  get embedded() {
    return this.config.embedded
  }

  get containerShrinkRatio() {
    return this.config.containerShrinkRatio
  }

  get supportsSidebar() {
    return this.config.supportsSidebar ?? false
  }

  get platform() {
    return this.config.platform
  }

  get supportsAiSubtitles(): boolean {
    return this.subtitlesSwitch.supportsAiSubtitles
  }

  constructor({
    config,
    fetchers,
  }: {
    config: PlatformConfig
    fetchers: SubtitlesFetcherFactories
  }) {
    this.config = config
    const context: AdapterContext = {
      config,
      lifecycle: this.lifecycle,
      getScheduler: () => this.player.subtitlesScheduler,
      getFetcher: () => this.subtitlesSwitch.fetcher,
    }
    this.player = new PlayerAttachment({
      ...context,
      adapter: this,
      onPlayerReady: async () => {
        this.adWatch.setupAdObserver()
        await this.startRequests.tryAutoStartSubtitles()
      },
    })
    this.nativeCaptions = new NativeCaptions(context)
    this.sourceCache = new SourceSubtitlesCache(context)
    this.session = new SubtitlesSession({ ...context, sourceCache: this.sourceCache })
    this.subtitlesSwitch = new SubtitlesSwitch({
      ...context,
      fetchers,
      nativeCaptions: this.nativeCaptions,
      sourceCache: this.sourceCache,
      session: this.session,
      hasPendingNavigationReset: () => this.navigation.hasPendingNavigationReset,
      startTranslation: (options) => this.starter.startTranslation(options),
    })
    this.starter = new SubtitlesStarter({
      ...context,
      sourceCache: this.sourceCache,
      session: this.session,
      subtitlesSwitch: this.subtitlesSwitch,
    })
    this.startRequests = new SubtitlesStartRequests({
      ...context,
      subtitlesSwitch: this.subtitlesSwitch,
    })
    this.adWatch = new AdPlaybackWatch({
      ...context,
      onAdStarted: () => this.starter.noteAdStarted(),
      onAdEnded: () => {
        // Resync content time when the ad ends so the next cue is correct immediately.
        this.player.subtitlesScheduler?.resyncFromVideo()
        this.session.translationCoordinator?.requestTick()
        this.starter.runRetryAfterAd()
      },
    })
    this.navigation = new NavigationWatch({
      ...context,
      session: this.session,
      sourceCache: this.sourceCache,
      onLeaveVideo: () => this.clearVisibleStateForNavigation(),
      onNavigated: async () => {
        this.resetForNavigation()
        await this.player.attachPlayer()
      },
    })
    this.videoSummary = new VideoSummaryStream({ ...context, sourceCache: this.sourceCache })
  }

  async initialize() {
    this.navigation.publishVideoId()
    this.initializeTranslatedSubtitlesDownloader()
    void this.player.restorePosition()
    await this.player.attachPlayer()
    if (this.lifecycle.destroyed) return
    this.navigation.setupNavigationListeners()
  }

  /**
   * Releases everything the adapter holds on the page. A document that swaps
   * player layouts (YouTube watch <-> Shorts) builds a new adapter per layout,
   * so the old one has to give back its DOM, timers, listeners and the shared
   * atoms before the next one publishes into them. Async work still waiting on
   * the DOM checks `destroyed` when it resumes and backs out.
   */
  destroy() {
    if (this.lifecycle.destroyed) return
    this.lifecycle.destroyed = true
    this.lifecycle.switchGeneration.next()
    this.navigation.cancelPendingNavigationReset()
    this.navigation.stop()
    this.startRequests.cancelFirstPlayStart()
    this.videoSummary.prepareSummaryForNavigation()
    this.adWatch.teardownAdObserver()
    this.translatedSubtitlesDownloader?.dispose()
    this.translatedSubtitlesDownloader = null
    this.player.destroyScheduler()
    this.session.clearRuntimeSession()
    this.sourceCache.clearSourceCache()
    this.subtitlesSwitch.releaseFetcher()
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, false)
    subtitlesStore.set(subtitlesSettingsPanelViewAtom, ROOT_VIEW)
    subtitlesStore.set(subtitlesVisibleAtom, false)
    subtitlesStore.set(translatedTrackAtom, [])
    this.nativeCaptions.showNativeSubtitles()
    this.player.removeTranslateButton()
  }

  getControlsConfig(): ControlsConfig | undefined {
    return this.config.controls
  }

  toggleSubtitlesManually = (enabled: boolean) => {
    this.startRequests.toggleSubtitlesWithSource(enabled, "manual")
  }

  toggleSubtitlesByShortcut = (enabled: boolean) => {
    this.startRequests.toggleSubtitlesWithSource(enabled, "shortcut")
  }

  handleSourceTrackChanged(): Promise<void> {
    return this.subtitlesSwitch.handleSourceTrackChanged()
  }

  generateVideoSummary = (config: Config, videoId?: string | null) =>
    this.videoSummary.generateVideoSummary(config, videoId)

  hasSubtitlesAvailable = () => this.subtitlesSwitch.fetcher.hasAvailableSubtitles()

  ensureSourceTrackPublished = () => this.subtitlesSwitch.ensureSourceTrackPublished()

  seekTo = (seconds: number) => {
    const video = this.player.subtitlesScheduler?.getVideoElement()
    if (video) {
      video.currentTime = seconds
    }
  }

  getVideoElement = () => this.player.subtitlesScheduler?.getVideoElement() ?? null

  getVideoPageUrl = () => this.config.getVideoPageUrl?.() ?? null

  downloadSourceSubtitles = () => this.sourceCache.downloadSourceSubtitles()

  downloadTranslatedSubtitles = async () => {
    this.initializeTranslatedSubtitlesDownloader()
    await this.translatedSubtitlesDownloader!.download()
  }

  private initializeTranslatedSubtitlesDownloader() {
    this.translatedSubtitlesDownloader ??= new TranslatedSubtitlesDownloader(
      () => this.subtitlesSwitch.fetcher,
      this.config,
    )
  }

  private resetForNavigation() {
    this.lifecycle.switchGeneration.next()
    this.lifecycle.playerGeneration.next()
    // An attach that finished while the navigation waited may have set one on the old video.
    this.startRequests.cancelFirstPlayStart()
    this.subtitlesSwitch.dropPendingStart()
    this.subtitlesSwitch.dropTrackChangeRefresh()
    this.videoSummary.prepareSummaryForNavigation()
    // Keyed by video id already; this only stops them accumulating.
    queryClient.removeQueries({ queryKey: VIDEO_SUMMARY_QUERY_SCOPE })
    this.navigation.clearNavigationReinitTimeout()
    this.adWatch.teardownAdObserver()
    this.player.destroyScheduler()
    this.session.clearRuntimeSession()
    this.sourceCache.clearSourceCache()
    this.subtitlesSwitch.resetToNativeFetcher()
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, false)
    subtitlesStore.set(subtitlesSettingsPanelViewAtom, ROOT_VIEW)
    this.nativeCaptions.showNativeSubtitles()
    void this.player.restorePosition()
    // Keep the sidebar open, but publish the next query only after old state is cleared.
    this.navigation.publishVideoId()
  }

  private clearVisibleStateForNavigation() {
    this.startRequests.cancelFirstPlayStart()
    this.videoSummary.prepareSummaryForNavigation()
    this.navigation.clearNavigationReinitTimeout()
    this.adWatch.teardownAdObserver()
    this.translatedSubtitlesDownloader?.dispose()
    this.player.destroyScheduler()
    this.session.translationCoordinator?.stop()
    this.session.segmentationPipeline?.stop()
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, false)
    subtitlesStore.set(subtitlesSettingsPanelViewAtom, ROOT_VIEW)
    this.nativeCaptions.showNativeSubtitles()
  }

  notifyNavigation() {
    this.navigation.notifyNavigation()
  }

  /** The page left the player for one with no video: stop its work and start nothing. */
  notifyLeave() {
    if (this.lifecycle.destroyed) return
    this.lifecycle.switchGeneration.next()
    this.lifecycle.playerGeneration.next()
    this.subtitlesSwitch.dropTrackChangeRefresh()
    this.navigation.cancelPendingNavigationReset()
    this.clearVisibleStateForNavigation()
    // No reset follows to drop the session, and a toggle would resume it on a player that is gone.
    this.session.clearRuntimeSession()
    // Its controls may stay hidden or vanish; the next player gets a button of its own.
    this.player.removeTranslateButton()
  }

  requestAiSubtitles = () => this.startRequests.requestAiSubtitles()
}
