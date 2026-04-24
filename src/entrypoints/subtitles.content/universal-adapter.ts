import type { ControlsConfig, PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import type { FeatureUsageContext } from "@/types/analytics"
import type { SubtitlesFetcher } from "@/utils/subtitles/fetchers/types"
import type { SubtitlesVideoContext } from "@/utils/subtitles/processor/translator"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { i18n } from "#imports"
import { toast } from "sonner"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { getProviderConfigById } from "@/utils/config/helpers"
import { getLocalConfig } from "@/utils/config/storage"
import { HIDE_NATIVE_CAPTIONS_STYLE_ID, NAVIGATION_HANDLER_DELAY, TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { waitForElement } from "@/utils/dom/wait-for-element"
import { OverlaySubtitlesError, ToastSubtitlesError } from "@/utils/subtitles/errors"
import { optimizeSubtitles } from "@/utils/subtitles/processor/optimizer"
import { buildSubtitlesSummaryContextHash, fetchSubtitlesSummary } from "@/utils/subtitles/processor/translator"
import { downloadSubtitlesAsSrt } from "@/utils/subtitles/srt"
import { subtitlesPositionAtom, subtitlesSettingsPanelOpenAtom, subtitlesSettingsPanelViewAtom, subtitlesStore } from "./atoms"
import { renderSubtitlesTranslateButton } from "./renderer/render-translate-button"
import { SegmentationPipeline } from "./segmentation-pipeline"
import { SubtitlesScheduler } from "./subtitles-scheduler"
import { TranslationCoordinator } from "./translation-coordinator"
import { ROOT_VIEW } from "./ui/subtitles-settings-panel/views"

type SubtitlesToggleSource = "manual" | "auto"

export class UniversalVideoAdapter {
  private config: PlatformConfig
  private subtitlesScheduler: SubtitlesScheduler | null = null
  private subtitlesFetcher: SubtitlesFetcher
  private navigationReinitTimeoutId: ReturnType<typeof setTimeout> | null = null
  private hasPendingNavigationReset = false

  private sourceSubtitles: SubtitlesFragment[] = []
  private sourceProcessedSubtitles: SubtitlesFragment[] = []
  private sourceVideoId: string | null = null

  private sessionSubtitles: SubtitlesFragment[] = []
  private sessionProcessedFragments: SubtitlesFragment[] = []
  private sessionVideoId: string | null = null

  private isNativeSubtitlesHidden = false
  private segmentationPipeline: SegmentationPipeline | null = null
  private translationCoordinator: TranslationCoordinator | null = null
  private subtitlesSummaryContextHash: string | null = null

  get videoIdChanged() {
    const currentVideoId = this.config.getVideoId?.()
    return !!(this.sessionVideoId && currentVideoId && currentVideoId !== this.sessionVideoId)
  }

  constructor({
    config,
    subtitlesFetcher,
  }: {
    config: PlatformConfig
    subtitlesFetcher: SubtitlesFetcher
  }) {
    this.config = config
    this.subtitlesFetcher = subtitlesFetcher
  }

  async initialize() {
    void this.restorePosition()
    void this.renderTranslateButton()

    await this.initializeScheduler()
    void this.getOrLoadSourceSubtitles().catch(() => {})
    await this.tryAutoStartSubtitles()
    this.setupNavigationListeners()
  }

  getControlsConfig(): ControlsConfig | undefined {
    return this.config.controls
  }

  toggleSubtitlesManually = (enabled: boolean) => {
    this.toggleSubtitlesWithSource(enabled, "manual")
  }

  downloadSourceSubtitles = async () => {
    await this.getOrLoadSourceSubtitles()

    await downloadSubtitlesAsSrt({
      subtitles: this.sourceProcessedSubtitles,
      pageTitle: document.title || "",
      videoId: this.config.getVideoId?.(),
    })
  }

  private async restorePosition() {
    const config = await getLocalConfig()
    const position = config?.videoSubtitles?.position
    if (position) {
      subtitlesStore.set(subtitlesPositionAtom, { ...position })
    }
  }

  private resetForNavigation() {
    this.clearNavigationReinitTimeout()
    this.destroyScheduler()
    this.clearRuntimeSession()
    this.clearSourceCache()
    this.subtitlesFetcher.cleanup()
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
    const video = await waitForElement(
      this.config.selectors.video,
      el => !!el.closest(this.config.selectors.playerContainer),
    ) as HTMLVideoElement | null

    if (!video) {
      toast.error(i18n.t("subtitles.errors.videoNotFound"))
      return
    }

    this.subtitlesScheduler = new SubtitlesScheduler({ videoElement: video })
    this.subtitlesScheduler.start()
    this.subtitlesScheduler.hide()
  }

  private async getOrLoadSourceSubtitles(): Promise<SubtitlesFragment[]> {
    const currentVideoId = this.config.getVideoId?.() ?? null
    const useSameTrack = await this.subtitlesFetcher.shouldUseSameTrack()

    if (useSameTrack && this.sourceVideoId === currentVideoId && this.sourceSubtitles.length > 0) {
      return this.sourceSubtitles
    }

    if (!await this.subtitlesFetcher.hasAvailableSubtitles()) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }

    const subtitles = await this.subtitlesFetcher.fetch()
    if (subtitles.length === 0) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }

    this.sourceVideoId = currentVideoId
    this.sourceSubtitles = subtitles
    this.sourceProcessedSubtitles = this.buildSourceProcessedSubtitles(subtitles)

    return subtitles
  }

  private buildSourceProcessedSubtitles(rawSubtitles: SubtitlesFragment[]): SubtitlesFragment[] {
    const sourceLanguage = this.subtitlesFetcher.getSourceLanguage()
    return optimizeSubtitles(rawSubtitles, sourceLanguage)
  }

  private clearSourceProcessedSubtitles() {
    this.sourceProcessedSubtitles = []
  }

  private clearSourceCache() {
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
  }

  private clearVisibleStateForNavigation() {
    this.clearNavigationReinitTimeout()
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

  private async handleNavigation() {
    if (!this.hasPendingNavigationReset || !this.videoIdChanged) {
      return
    }

    this.hasPendingNavigationReset = false
    this.resetForNavigation()
    void this.renderTranslateButton()

    await this.initializeScheduler()
    void this.getOrLoadSourceSubtitles().catch(() => {})
    await this.tryAutoStartSubtitles()
  }

  private async renderTranslateButton() {
    const controlsBar = await waitForElement(this.config.selectors.controlsBar)
    if (!controlsBar) {
      toast.error(i18n.t("subtitles.errors.controlsBarNotFound"))
      return
    }

    const existingButton = controlsBar.querySelector(`#${TRANSLATE_BUTTON_CONTAINER_ID}`)
    existingButton?.remove()

    const toggleButton = renderSubtitlesTranslateButton()

    controlsBar.insertBefore(toggleButton, controlsBar.firstChild)
  }

  private async tryAutoStartSubtitles() {
    const config = await getLocalConfig()
    const autoStart = config?.videoSubtitles?.autoStart ?? false

    if (!autoStart) {
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
            source === "auto"
              ? ANALYTICS_SURFACE.VIDEO_SUBTITLES_AUTO
              : ANALYTICS_SURFACE.VIDEO_SUBTITLES,
          )
        : undefined,
    )
  }

  private handleToggleSubtitles(enabled: boolean, analyticsContext?: FeatureUsageContext) {
    if (enabled) {
      this.subtitlesScheduler?.start()
      this.subtitlesScheduler?.show()
      this.hideNativeSubtitles()
      void this.startTranslation(analyticsContext)
    }
    else {
      this.subtitlesScheduler?.hide()
      this.showNativeSubtitles()
      this.translationCoordinator?.stop()
    }
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
    try {
      const currentVideoId = this.config.getVideoId?.() ?? ""
      const hasCurrentSession = this.translationCoordinator !== null && this.sessionVideoId === currentVideoId
      this.sessionVideoId = currentVideoId

      const useSameTrack = await this.subtitlesFetcher.shouldUseSameTrack()

      if (useSameTrack && hasCurrentSession) {
        // Clear failed states to allow retry on resume
        this.translationCoordinator?.clearFailed()
        this.segmentationPipeline?.clearFailedStarts()
        this.translationCoordinator?.start()
        if (analyticsContext) {
          void trackFeatureUsed({
            ...analyticsContext,
            outcome: "success",
          })
        }
        return
      }

      this.clearRuntimeSession()
      this.sessionVideoId = currentVideoId
      this.subtitlesScheduler?.reset()

      this.subtitlesScheduler?.setState("loading")

      await this.getOrLoadSourceSubtitles()
      this.sessionSubtitles = this.sourceSubtitles

      await this.processSubtitles()
      if (analyticsContext) {
        void trackFeatureUsed({
          ...analyticsContext,
          outcome: "success",
        })
      }
    }
    catch (error) {
      if (analyticsContext) {
        void trackFeatureUsed({
          ...analyticsContext,
          outcome: "failure",
        })
      }
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (error instanceof ToastSubtitlesError) {
        toast.error(errorMessage)
      }
      else {
        this.subtitlesScheduler?.setState("error", { message: errorMessage })
      }
    }
  }

  private async processSubtitles() {
    const scheduler = this.subtitlesScheduler
    if (!scheduler)
      return

    const config = await getLocalConfig()

    const useAiSegmentation = !!config?.videoSubtitles?.aiSegmentation
    const providerConfig = config
      ? getProviderConfigById(config.providersConfig, config.videoSubtitles.providerId)
      : undefined

    const videoContext: SubtitlesVideoContext = {
      videoTitle: document.title || "",
      subtitlesTextContent: this.sessionSubtitles.map(f => f.text).join(""),
    }

    if (useAiSegmentation) {
      this.sessionProcessedFragments = [...this.sourceProcessedSubtitles]
      this.segmentationPipeline = new SegmentationPipeline({
        baselineFragments: this.sourceProcessedSubtitles,
        rawFragments: this.sessionSubtitles,
        getVideoElement: () => this.subtitlesScheduler?.getVideoElement() ?? null,
        getSourceLanguage: () => this.subtitlesFetcher.getSourceLanguage(),
      })
    }
    else {
      this.sessionProcessedFragments = [...this.sourceProcessedSubtitles]
    }

    this.translationCoordinator = new TranslationCoordinator({
      getFragments: () => this.segmentationPipeline
        ? this.segmentationPipeline.processedFragments
        : this.sessionProcessedFragments,
      getVideoElement: () => scheduler.getVideoElement(),
      getCurrentState: () => scheduler.getState(),
      segmentationPipeline: this.segmentationPipeline,
      onTranslated: fragments => scheduler.supplementSubtitles(fragments),
      onStateChange: (state, data) => scheduler.setState(state, data),
    })
    this.translationCoordinator.start(videoContext)
    const summaryContextHash = buildSubtitlesSummaryContextHash(videoContext, providerConfig)
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
