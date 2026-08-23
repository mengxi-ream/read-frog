import type { ControlsConfig, PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import type { AnalyticsSurface, FeatureUsageContext } from "@/types/analytics"
import type { SubtitlesSource } from "@/utils/constants/subtitles"
import type { SubtitlesFetcher } from "@/utils/subtitles/fetchers/types"
import type { SubtitlesVideoContext } from "@/utils/subtitles/processor/translator"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { toastManager } from "@/components/ui/base-ui/toast"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { classifyResolvedProvider, UNKNOWN_FEATURE_PROVIDER } from "@/utils/analytics-provider"
import { getLocalConfig } from "@/utils/config/storage"
import {
  HIDE_NATIVE_CAPTIONS_STYLE_ID,
  NAVIGATION_HANDLER_DELAY,
  SUBTITLES_SOURCE,
  TRANSLATE_BUTTON_CONTAINER_ID,
} from "@/utils/constants/subtitles"
import { getDocumentDescription } from "@/utils/content/metadata"
import { resolveLanguageCodeFromLocale } from "@/utils/content/page-language"
import { waitForElement } from "@/utils/dom/wait-for-element"
import { i18n } from "@/utils/i18n"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { OverlaySubtitlesError, ToastSubtitlesError } from "@/utils/subtitles/errors"
import { optimizeSubtitles } from "@/utils/subtitles/processor/optimizer"
import {
  buildSubtitlesSummaryContextHash,
  resolveSubtitlesProviderRef,
  fetchSubtitlesSummary,
} from "@/utils/subtitles/processor/translator"
import { downloadSubtitlesAsSrt } from "@/utils/subtitles/srt"
import { showAiSubtitlesWallToast, showSubtitlesErrorToast } from "@/utils/subtitles/toast"
import { requestVideoSummary, VIDEO_SUMMARY_QUERY_KEY } from "@/utils/subtitles/video-summary"
import { queryClient } from "@/utils/tanstack-query"
import {
  adPlayingAtom,
  currentTimeMsAtom,
  sourceTrackAtom,
  subtitlesPositionAtom,
  subtitlesSettingsPanelOpenAtom,
  subtitlesSettingsPanelViewAtom,
  subtitlesSourceAtom,
  subtitlesStore,
} from "./atoms"
import { renderSubtitlesTranslateButton } from "./renderer/render-translate-button"
import { SegmentationPipeline } from "./segmentation-pipeline"
import { SubtitlesScheduler } from "./subtitles-scheduler"
import { TranslatedSubtitlesDownloader } from "./translated-subtitles-downloader"
import { TranslationCoordinator } from "./translation-coordinator"
import { ROOT_VIEW } from "./ui/subtitles-settings-panel/views"

type SubtitlesToggleSource = "manual" | "auto" | "shortcut"

const TOGGLE_SOURCE_SURFACE: Record<SubtitlesToggleSource, AnalyticsSurface> = {
  manual: ANALYTICS_SURFACE.VIDEO_SUBTITLES,
  auto: ANALYTICS_SURFACE.VIDEO_SUBTITLES_AUTO,
  shortcut: ANALYTICS_SURFACE.SHORTCUT,
}

type SubtitlesFetcherFactories = {
  native: () => SubtitlesFetcher
  ai?: () => SubtitlesFetcher
}

const LOADING_MESSAGE: Record<SubtitlesSource, string | undefined> = {
  [SUBTITLES_SOURCE.NATIVE]: undefined,
  [SUBTITLES_SOURCE.AI]: i18n.t("subtitles.loadingAiSubtitles"),
}

export interface SubtitlesProvidersAdapter {
  readonly embedded: boolean | undefined
  readonly containerShrinkRatio: ((container: HTMLElement) => number | null) | undefined
  readonly supportsAiSubtitles: boolean
  getControlsConfig: () => ControlsConfig | undefined
  readonly supportsSidebar: boolean
  generateVideoSummary: () => Promise<string | null>
  hasSubtitlesAvailable: () => Promise<boolean>
  toggleSubtitlesManually: (enabled: boolean) => void
  toggleSubtitlesByShortcut: (enabled: boolean) => void
  requestAiSubtitles: () => Promise<void>
  downloadSourceSubtitles: () => Promise<void>
  downloadTranslatedSubtitles: () => Promise<void>
}

export class UniversalVideoAdapter implements SubtitlesProvidersAdapter {
  private config: PlatformConfig
  private subtitlesScheduler: SubtitlesScheduler | null = null
  private fetchers: SubtitlesFetcherFactories
  private source: SubtitlesSource = SUBTITLES_SOURCE.NATIVE
  private fetcher: SubtitlesFetcher
  private switchOperationId = 0
  private navigationReinitTimeoutId: ReturnType<typeof setTimeout> | null = null
  private hasPendingNavigationReset = false
  private trackChangeRefreshPromise: Promise<void> | null = null

  private sourceSubtitles: SubtitlesFragment[] = []
  private sourceProcessedSubtitles: SubtitlesFragment[] = []
  private sourceVideoId: string | null = null

  private sessionSubtitles: SubtitlesFragment[] = []
  private sessionProcessedFragments: SubtitlesFragment[] = []
  private sessionVideoId: string | null = null

  private isNativeSubtitlesHidden = false
  private segmentationPipeline: SegmentationPipeline | null = null
  private translationCoordinator: TranslationCoordinator | null = null
  private translatedSubtitlesDownloader: TranslatedSubtitlesDownloader | null = null
  private subtitlesSummaryContextHash: string | null = null
  private adObserver: MutationObserver | null = null
  private observedAdPlayer: HTMLElement | null = null

  get embedded() {
    return this.config.embedded
  }

  get containerShrinkRatio() {
    return this.config.containerShrinkRatio
  }

  get supportsSidebar() {
    return this.config.supportsSidebar ?? false
  }

  get videoIdChanged() {
    const currentVideoId = this.config.getVideoId?.()
    return !!(this.sessionVideoId && currentVideoId && currentVideoId !== this.sessionVideoId)
  }

  get supportsAiSubtitles(): boolean {
    return !!this.fetchers.ai
  }

  constructor({
    config,
    fetchers,
  }: {
    config: PlatformConfig
    fetchers: SubtitlesFetcherFactories
  }) {
    this.config = config
    this.fetchers = fetchers
    this.fetcher = fetchers.native()
  }

  async initialize() {
    this.initializeTranslatedSubtitlesDownloader()
    void this.restorePosition()
    void this.renderTranslateButton()

    await this.initializeScheduler()
    this.setupAdObserver()
    await this.tryAutoStartSubtitles()
    this.setupNavigationListeners()
  }

  getControlsConfig(): ControlsConfig | undefined {
    return this.config.controls
  }

  toggleSubtitlesManually = (enabled: boolean) => {
    this.toggleSubtitlesWithSource(enabled, "manual")
  }

  toggleSubtitlesByShortcut = (enabled: boolean) => {
    this.toggleSubtitlesWithSource(enabled, "shortcut")
  }

  async handleSourceTrackChanged(): Promise<void> {
    if (!this.trackChangeRefreshPromise) {
      this.trackChangeRefreshPromise = this.refreshSourceTrackIfNeeded().finally(() => {
        this.trackChangeRefreshPromise = null
      })
    }

    await this.trackChangeRefreshPromise
  }

  generateVideoSummary = async () => {
    await this.getOrLoadSourceSubtitles()
    return await requestVideoSummary(this.sourceProcessedSubtitles)
  }

  hasSubtitlesAvailable = () => this.fetcher.hasAvailableSubtitles()

  downloadSourceSubtitles = async () => {
    await this.getOrLoadSourceSubtitles()

    await downloadSubtitlesAsSrt({
      subtitles: this.sourceProcessedSubtitles,
      pageTitle: document.title || "",
      videoId: this.config.getVideoId?.(),
    })
  }

  downloadTranslatedSubtitles = async () => {
    this.initializeTranslatedSubtitlesDownloader()
    await this.translatedSubtitlesDownloader!.download()
  }

  private initializeTranslatedSubtitlesDownloader() {
    this.translatedSubtitlesDownloader ??= new TranslatedSubtitlesDownloader(
      () => this.fetcher,
      this.config,
    )
  }

  private async restorePosition() {
    const config = await getLocalConfig()
    const position = config?.videoSubtitles?.position
    if (position) {
      subtitlesStore.set(subtitlesPositionAtom, { ...position })
    }
  }

  private resetForNavigation() {
    this.switchOperationId++
    this.clearNavigationReinitTimeout()
    this.teardownAdObserver()
    this.destroyScheduler()
    this.clearRuntimeSession()
    this.clearSourceCache()
    this.fetcher.cleanup()
    if (this.source !== SUBTITLES_SOURCE.NATIVE) {
      this.source = SUBTITLES_SOURCE.NATIVE
      this.fetcher = this.fetchers.native()
    }
    subtitlesStore.set(subtitlesSourceAtom, SUBTITLES_SOURCE.NATIVE)
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, false)
    subtitlesStore.set(subtitlesSettingsPanelViewAtom, ROOT_VIEW)
    this.showNativeSubtitles()
    void this.restorePosition()
  }

  private destroyScheduler() {
    this.subtitlesScheduler?.reset()
    this.subtitlesScheduler?.stop()
    this.subtitlesScheduler = null
  }

  private async initializeScheduler() {
    const video = (await waitForElement(
      this.config.selectors.video,
      (el) => !!el.closest(this.config.selectors.playerContainer),
    )) as HTMLVideoElement | null

    if (!video) {
      toastManager.add({ type: "error", title: i18n.t("subtitles.errors.videoNotFound") })
      return
    }

    this.subtitlesScheduler = new SubtitlesScheduler({ videoElement: video })
    this.subtitlesScheduler.start()
    this.subtitlesScheduler.hide()
  }

  private async getOrLoadSourceSubtitles(): Promise<SubtitlesFragment[]> {
    const currentVideoId = this.config.getVideoId?.() ?? null
    const useSameTrack = await this.fetcher.shouldUseSameTrack()

    if (useSameTrack && this.sourceVideoId === currentVideoId && this.sourceSubtitles.length > 0) {
      return this.sourceSubtitles
    }

    if (!(await this.fetcher.hasAvailableSubtitles())) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }

    const subtitles = await this.fetcher.fetch()
    if (subtitles.length === 0) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }

    this.sourceVideoId = currentVideoId
    this.sourceSubtitles = subtitles
    this.sourceProcessedSubtitles = this.buildSourceProcessedSubtitles(subtitles)

    return subtitles
  }

  private buildSourceProcessedSubtitles(rawSubtitles: SubtitlesFragment[]): SubtitlesFragment[] {
    if (this.fetcher.isPreSegmented?.()) return rawSubtitles
    const sourceLanguage = this.fetcher.getSourceLanguage()
    return optimizeSubtitles(rawSubtitles, sourceLanguage)
  }

  private clearSourceProcessedSubtitles() {
    this.sourceProcessedSubtitles = []
  }

  private clearSourceCache() {
    // The summary is derived from the source track, so it dies with it.
    queryClient.removeQueries({ queryKey: VIDEO_SUMMARY_QUERY_KEY })
    this.sourceSubtitles = []
    this.clearSourceProcessedSubtitles()
    this.sourceVideoId = null
  }

  private clearRuntimeSession() {
    this.translationCoordinator?.stop()
    this.segmentationPipeline?.stop()
    this.translationCoordinator = null
    this.segmentationPipeline = null
    this.sessionSubtitles = []
    this.sessionProcessedFragments = []
    this.sessionVideoId = null
    this.subtitlesSummaryContextHash = null
    subtitlesStore.set(sourceTrackAtom, [])
  }

  private clearVisibleStateForNavigation() {
    this.clearNavigationReinitTimeout()
    this.teardownAdObserver()
    this.translatedSubtitlesDownloader?.dispose()
    this.destroyScheduler()
    this.translationCoordinator?.stop()
    this.segmentationPipeline?.stop()
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, false)
    subtitlesStore.set(subtitlesSettingsPanelViewAtom, ROOT_VIEW)
    this.showNativeSubtitles()
  }

  private clearNavigationReinitTimeout() {
    if (this.navigationReinitTimeoutId !== null) {
      clearTimeout(this.navigationReinitTimeoutId)
      this.navigationReinitTimeoutId = null
    }
  }

  private setupNavigationListeners() {
    const { events } = this.config

    if (events.navigateStart) {
      window.addEventListener(events.navigateStart, this.handleNavigationStart)
    }

    if (events.navigateFinish) {
      window.addEventListener(events.navigateFinish, this.handleNavigationFinish)
    }
  }

  private handleNavigationStart = () => {
    if (!this.videoIdChanged) {
      return
    }

    this.hasPendingNavigationReset = true
    this.clearVisibleStateForNavigation()
  }

  private handleNavigationFinish = () => {
    if (!this.hasPendingNavigationReset) {
      return
    }

    this.clearNavigationReinitTimeout()
    this.navigationReinitTimeoutId = setTimeout(() => {
      this.navigationReinitTimeoutId = null
      void this.handleNavigation()
    }, NAVIGATION_HANDLER_DELAY)
  }

  notifyNavigation() {
    this.hasPendingNavigationReset = true
    this.clearVisibleStateForNavigation()

    this.clearNavigationReinitTimeout()
    this.navigationReinitTimeoutId = setTimeout(() => {
      this.navigationReinitTimeoutId = null
      void this.handleNavigation()
    }, NAVIGATION_HANDLER_DELAY)
  }

  private async handleNavigation() {
    if (!this.hasPendingNavigationReset || !this.videoIdChanged) {
      return
    }

    this.hasPendingNavigationReset = false
    this.resetForNavigation()
    void this.renderTranslateButton()

    await this.initializeScheduler()
    this.setupAdObserver()
    await this.tryAutoStartSubtitles()
  }

  private setupAdObserver() {
    if (!this.config.isAdPlaying) {
      return
    }

    this.teardownAdObserver()

    const player = document.querySelector<HTMLElement>(this.config.selectors.playerContainer)
    if (!player) {
      subtitlesStore.set(adPlayingAtom, false)
      return
    }

    this.observedAdPlayer = player
    this.syncAdPlayingState()

    this.adObserver = new MutationObserver(() => {
      this.syncAdPlayingState()
    })
    this.adObserver.observe(player, { attributes: true, attributeFilter: ["class"] })
  }

  private teardownAdObserver() {
    this.adObserver?.disconnect()
    this.adObserver = null
    this.observedAdPlayer = null
    subtitlesStore.set(adPlayingAtom, false)
  }

  private syncAdPlayingState() {
    const isAdPlaying = this.config.isAdPlaying
    if (!isAdPlaying) {
      return
    }

    const player =
      this.observedAdPlayer ??
      document.querySelector<HTMLElement>(this.config.selectors.playerContainer)

    const playing = !!player && isAdPlaying(player)
    const wasPlaying = subtitlesStore.get(adPlayingAtom)
    if (playing === wasPlaying) {
      return
    }

    subtitlesStore.set(adPlayingAtom, playing)

    // Resync content time when the ad ends so the next cue is correct immediately.
    if (!playing) {
      this.subtitlesScheduler?.resyncFromVideo()
      this.translationCoordinator?.requestTick()
    }
  }

  private async renderTranslateButton() {
    const controlsBar = this.config.selectors.controlsBar
    if (!controlsBar) {
      return
    }

    const container = await waitForElement(controlsBar)
    if (!container) {
      if (!this.config.embedded) {
        toastManager.add({
          type: "error",
          title: i18n.t("subtitles.errors.controlsBarNotFound"),
        })
      }
      return
    }

    const existingButton = container.querySelector(`#${TRANSLATE_BUTTON_CONTAINER_ID}`)
    existingButton?.remove()

    const toggleButton = renderSubtitlesTranslateButton({ adapter: this })

    if (this.config.embedded) {
      container.appendChild(toggleButton)
    } else {
      container.insertBefore(toggleButton, container.firstChild)
    }
  }

  private async tryAutoStartSubtitles() {
    const config = await getLocalConfig()
    const autoStart = config?.videoSubtitles?.autoStart ?? false

    if (!autoStart) return

    if (this.config.embedded) {
      const video = this.subtitlesScheduler?.getVideoElement()
      if (!video) return

      const start = () => {
        video.removeEventListener("playing", start)
        this.toggleSubtitlesWithSource(true, "auto")
      }

      if (!video.paused) {
        this.toggleSubtitlesWithSource(true, "auto")
      } else {
        video.addEventListener("playing", start)
      }
      return
    }

    this.toggleSubtitlesWithSource(true, "auto")
  }

  private toggleSubtitlesWithSource(enabled: boolean, source: SubtitlesToggleSource) {
    this.handleToggleSubtitles(
      enabled,
      enabled
        ? createFeatureUsageContext(
            ANALYTICS_FEATURE.VIDEO_SUBTITLES,
            TOGGLE_SOURCE_SURFACE[source],
          )
        : undefined,
    )
  }

  private handleToggleSubtitles(enabled: boolean, analyticsContext?: FeatureUsageContext) {
    if (enabled) {
      void this.switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE, analyticsContext)
    } else {
      this.subtitlesScheduler?.hide()
      this.showNativeSubtitles()
      this.translationCoordinator?.stop()
    }
  }

  requestAiSubtitles = async (): Promise<void> => {
    if (await this.config.isLiveContent?.()) {
      showAiSubtitlesWallToast(i18n.t("subtitles.errors.aiLiveReplayUnsupported"))
      return
    }
    return this.switchSubtitlesFetcher(SUBTITLES_SOURCE.AI)
  }

  private async switchSubtitlesFetcher(
    next: SubtitlesSource,
    analyticsContext?: FeatureUsageContext,
  ): Promise<void> {
    const make = this.fetchers[next]
    if (!make) {
      return
    }

    const operationId = ++this.switchOperationId

    if (next !== this.source) {
      this.fetcher.cleanup()
      this.source = next
      subtitlesStore.set(subtitlesSourceAtom, next)
      this.fetcher = make()
      this.clearSourceCache()
      this.clearRuntimeSession()
    }

    this.subtitlesScheduler?.start()
    this.subtitlesScheduler?.show()
    this.hideNativeSubtitles()

    const message = LOADING_MESSAGE[next]
    if (message) {
      this.subtitlesScheduler?.setState("loading", { message })
    }

    const succeeded = await this.startTranslation(analyticsContext)
    if (operationId !== this.switchOperationId) {
      return
    }
    if (!succeeded && next !== SUBTITLES_SOURCE.NATIVE) {
      this.revertToNativeSource()
    }
  }

  private revertToNativeSource() {
    this.fetcher.cleanup()
    this.source = SUBTITLES_SOURCE.NATIVE
    this.fetcher = this.fetchers.native()
    subtitlesStore.set(subtitlesSourceAtom, SUBTITLES_SOURCE.NATIVE)
    this.clearSourceCache()
    this.clearRuntimeSession()
    this.showNativeSubtitles()
  }

  private async refreshSourceTrackIfNeeded(): Promise<void> {
    const scheduler = this.subtitlesScheduler
    if (!scheduler || !scheduler.isActive()) {
      return
    }

    const useSameTrack = await this.fetcher.shouldUseSameTrack()
    if (useSameTrack) {
      return
    }

    this.clearRuntimeSession()
    this.clearSourceCache()
    this.fetcher.cleanup()
    scheduler.reset()
    scheduler.setState("loading")

    await this.startTranslation()
  }

  private showNativeSubtitles() {
    if (!this.isNativeSubtitlesHidden) {
      return
    }

    const style = document.getElementById(HIDE_NATIVE_CAPTIONS_STYLE_ID)
    style?.remove()
    this.isNativeSubtitlesHidden = false
  }

  private hideNativeSubtitles() {
    if (this.isNativeSubtitlesHidden) {
      return
    }

    if (document.getElementById(HIDE_NATIVE_CAPTIONS_STYLE_ID)) {
      this.isNativeSubtitlesHidden = true
      return
    }

    const style = document.createElement("style")
    style.id = HIDE_NATIVE_CAPTIONS_STYLE_ID
    style.textContent = `
      ${this.config.selectors.nativeSubtitles},
      ${this.config.selectors.nativeSubtitles} * {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
      }
    `
    document.head.appendChild(style)
    this.isNativeSubtitlesHidden = true
  }

  private async startTranslation(analyticsContext?: FeatureUsageContext) {
    let providerAnalytics = UNKNOWN_FEATURE_PROVIDER

    try {
      const analyticsConfig = await getLocalConfig()
      // Resolve through the capability registry, not providersConfig: Built-in
      // AI is synthesized by the registry and is never a row there, so the
      // lookup returned undefined and every hosted subtitle run was reported as
      // provider "unknown" — the one metric that would size hosted adoption.
      providerAnalytics = classifyResolvedProvider(
        analyticsConfig
          ? resolveProviderRefForCapability(
              "videoSubtitles",
              analyticsConfig.providersConfig,
              analyticsConfig.videoSubtitles.providerId,
            )
          : null,
      )
      const currentVideoId = this.config.getVideoId?.() ?? ""
      const hasCurrentSession =
        this.sessionProcessedFragments.length > 0 && this.sessionVideoId === currentVideoId
      this.sessionVideoId = currentVideoId

      const useSameTrack = await this.fetcher.shouldUseSameTrack()

      if (useSameTrack && hasCurrentSession) {
        // Translated sessions create a coordinator; passthrough sessions only cache rendered fragments.
        if (this.translationCoordinator) {
          // Clear failed states to allow retry on resume
          this.translationCoordinator.clearFailed()
          this.segmentationPipeline?.clearFailedStarts()
          this.translationCoordinator.start()
        } else {
          this.subtitlesScheduler?.supplementSubtitles(this.sessionProcessedFragments)
          this.subtitlesScheduler?.setState("idle")
        }
        if (analyticsContext) {
          void trackFeatureUsed({
            ...analyticsContext,
            ...providerAnalytics,
            outcome: "success",
          })
        }
        return true
      }

      this.clearRuntimeSession()
      this.sessionVideoId = currentVideoId
      this.subtitlesScheduler?.reset()

      this.subtitlesScheduler?.setState("loading", { message: LOADING_MESSAGE[this.source] })

      await this.getOrLoadSourceSubtitles()
      this.sessionSubtitles = this.sourceSubtitles

      if (await this.shouldSkipTranslationForCurrentTrack()) {
        this.processPassthroughSubtitles()
      } else {
        await this.processTranslatedSubtitles()
      }
      if (analyticsContext) {
        void trackFeatureUsed({
          ...analyticsContext,
          ...providerAnalytics,
          outcome: "success",
        })
      }
      return true
    } catch (error) {
      if (analyticsContext) {
        void trackFeatureUsed({
          ...analyticsContext,
          ...providerAnalytics,
          outcome: "failure",
        })
      }

      // A deliberate teardown — a superseded switch or a navigation — not a
      // failure the user should read about. Its message is the literal string
      // "Aborted", which would otherwise be painted onto the player untranslated.
      if (error instanceof DOMException && error.name === "AbortError") {
        return false
      }

      const errorMessage = error instanceof Error ? error.message : String(error)

      if (error instanceof ToastSubtitlesError) {
        // The loading state has no auto-hide of its own (unlike "error"), so
        // the toast branch has to clear it — otherwise the "Loading AI
        // subtitles" pill stays on the player forever after a wall.
        this.subtitlesScheduler?.setState("idle")
        // Only the AI request has a control on screen to point at; the source
        // is still AI here because reverting to native happens after this.
        if (this.source === SUBTITLES_SOURCE.AI) {
          showAiSubtitlesWallToast(errorMessage, error.action)
        } else {
          showSubtitlesErrorToast(errorMessage, error.action)
        }
      } else {
        this.subtitlesScheduler?.setState("error", {
          message: this.config.silentErrors ? "" : errorMessage,
        })
      }
      return false
    }
  }

  private async shouldSkipTranslationForCurrentTrack(): Promise<boolean> {
    const config = await getLocalConfig()
    const targetLanguage = config?.language.targetCode
    const sourceLanguage = resolveLanguageCodeFromLocale(this.fetcher.getSourceLanguage())

    if (!targetLanguage || !sourceLanguage) {
      return false
    }

    return sourceLanguage === targetLanguage
  }

  private processPassthroughSubtitles() {
    this.sessionProcessedFragments = this.sourceProcessedSubtitles.map((fragment) => ({
      ...fragment,
      translation: fragment.text,
    }))
    this.publishSourceTrack(this.sourceProcessedSubtitles)
    this.subtitlesScheduler?.supplementSubtitles(this.sessionProcessedFragments)
    this.subtitlesScheduler?.setState("idle")
  }

  private publishSourceTrack(fragments: SubtitlesFragment[]) {
    // timeupdate may not have fired yet (paused / enable mid-video); keep display time fresh.
    const video = this.subtitlesScheduler?.getVideoElement()
    if (video) {
      subtitlesStore.set(currentTimeMsAtom, video.currentTime * 1000)
    }
    subtitlesStore.set(sourceTrackAtom, [...fragments])
  }

  private replaceSourceTrackWindow(
    windowStartMs: number,
    windowEndMs: number,
    nextFragments: SubtitlesFragment[],
  ) {
    const previous = subtitlesStore.get(sourceTrackAtom)
    // Drop any cue that overlaps the window (not just cues whose start falls inside it).
    // Half-open: keep if end <= windowStart || start >= windowEnd.
    const kept = previous.filter(
      (fragment) => fragment.end <= windowStartMs || fragment.start >= windowEndMs,
    )
    const next = [...kept, ...nextFragments].sort((a, b) => a.start - b.start)
    this.publishSourceTrack(next)
  }

  private async processTranslatedSubtitles() {
    const scheduler = this.subtitlesScheduler
    if (!scheduler) return

    const config = await getLocalConfig()

    const useAiSegmentation = !!config?.videoSubtitles?.aiSegmentation

    this.sessionProcessedFragments = [...this.sourceProcessedSubtitles]

    // Source track for display fallback; scheduler only receives translated cues
    // later. Published before the provider resolve below, which none of this
    // depends on: for a hosted provider that resolve can reach the network, and
    // this is the only path that puts captions on screen for the translated
    // flow — so sequencing it second made the original captions wait on a round
    // trip they never needed, and a hung request (backgroundFetch carries no
    // timeout) left the player in "loading" showing nothing at all.
    this.publishSourceTrack(this.sessionProcessedFragments)

    // Resolved once per session; the cache key needs the same identity the
    // background will use, and a hosted ref costs one status fetch here rather
    // than one per fragment.
    const providerRef = config ? await resolveSubtitlesProviderRef(config, "videoSubtitles") : null

    const videoContext: SubtitlesVideoContext = {
      videoTitle: document.title || "",
      videoDescription: getDocumentDescription(document),
      subtitlesTextContent: this.sessionSubtitles.map((f) => f.text).join(""),
    }

    if (useAiSegmentation) {
      this.segmentationPipeline = new SegmentationPipeline({
        baselineFragments: this.sourceProcessedSubtitles,
        rawFragments: this.sessionSubtitles,
        getVideoElement: () => this.subtitlesScheduler?.getVideoElement() ?? null,
        getSourceLanguage: () => this.fetcher.getSourceLanguage(),
        // The session ref covers segmentation too: both subtitle routes gate on
        // the same hosted feature, and per-block re-resolution would cost a
        // hostedAi.status round trip per look-ahead window.
        providerRef,
        preSegmented: this.fetcher.isPreSegmented?.(),
        onChunkSegmented: (chunk, nextFragments) => {
          if (chunk.length === 0 || !chunk[0]) return
          const chunkStart = chunk[0].start
          const chunkEnd = chunk.at(-1)!.end
          this.replaceSourceTrackWindow(chunkStart, chunkEnd, nextFragments)
          // Drop identity-changed/spanning translations; keep translations for unchanged cues
          // so preSegmented (and partial AI recuts) do not wipe work then skip re-translate.
          scheduler.reconcileTranslatedCuesAfterRecut(chunkStart, chunkEnd, nextFragments)
          this.translationCoordinator?.noteFragmentListChanged()
        },
      })
    }

    this.translationCoordinator = new TranslationCoordinator({
      getFragments: () =>
        this.segmentationPipeline
          ? this.segmentationPipeline.processedFragments
          : this.sessionProcessedFragments,
      getVideoElement: () => scheduler.getVideoElement(),
      getCurrentState: () => scheduler.getState(),
      segmentationPipeline: this.segmentationPipeline,
      onTranslated: (fragments) => scheduler.supplementSubtitles(fragments),
      onStateChange: (state, data) => scheduler.setState(state, data),
    })
    this.translationCoordinator.start(videoContext)
    const summaryContextHash = buildSubtitlesSummaryContextHash(
      videoContext,
      providerRef ?? undefined,
    )
    this.subtitlesSummaryContextHash = summaryContextHash ?? null

    void fetchSubtitlesSummary(videoContext).then((summary) => {
      if (!summaryContextHash) {
        return
      }

      if (this.subtitlesSummaryContextHash !== summaryContextHash) {
        return
      }

      videoContext.summary = summary
    })
  }
}
