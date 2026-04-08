import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
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
import { ToastSubtitlesError } from "@/utils/subtitles/errors"
import { optimizeSubtitles } from "@/utils/subtitles/processor/optimizer"
import { buildSubtitlesSummaryContextHash, fetchSubtitlesSummary } from "@/utils/subtitles/processor/translator"
import { subtitlesPositionAtom, subtitlesSettingsPanelOpenAtom, subtitlesStore } from "./atoms"
import { renderSubtitlesTranslateButton } from "./renderer/render-translate-button"
import { SegmentationPipeline } from "./segmentation-pipeline"
import { SubtitlesScheduler } from "./subtitles-scheduler"
import { TranslationCoordinator } from "./translation-coordinator"

type SubtitlesToggleSource = "manual" | "auto"

export class UniversalVideoAdapter {
  private config: PlatformConfig
  private subtitlesScheduler: SubtitlesScheduler | null = null
  private subtitlesFetcher: SubtitlesFetcher

  private originalSubtitles: SubtitlesFragment[] = []
  private isNativeSubtitlesHidden = false
  private cachedVideoId: string | null = null

  // Non-AI path: processed fragments stored directly
  private processedFragments: SubtitlesFragment[] = []
  // AI path: segmentation pipeline handles processing
  private segmentationPipeline: SegmentationPipeline | null = null

  private translationCoordinator: TranslationCoordinator | null = null
  private subtitlesSummaryContextHash: string | null = null

  get videoIdChanged() {
    const currentVideoId = this.config.getVideoId?.()
    return !!(this.cachedVideoId && currentVideoId && currentVideoId !== this.cachedVideoId)
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
    await this.tryAutoStartSubtitles()
    this.setupNavigationListener()
  }

  toggleSubtitlesManually = (enabled: boolean) => {
    this.toggleSubtitlesWithSource(enabled, "manual")
  }

  private async restorePosition() {
    const config = await getLocalConfig()
    const position = config?.videoSubtitles?.position
    if (position) {
      subtitlesStore.set(subtitlesPositionAtom, { ...position })
    }
  }

  private resetForNavigation() {
    this.destroyScheduler()
    this.translationCoordinator?.stop()
    this.translationCoordinator = null
    this.processedFragments = []
    this.segmentationPipeline = null
    this.originalSubtitles = []
    this.cachedVideoId = null
    this.subtitlesSummaryContextHash = null
    this.subtitlesFetcher.cleanup()
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, false)
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

  private setupNavigationListener() {
    const { events } = this.config

    if (events.navigate) {
      const navigationListener = () => {
        if (!this.videoIdChanged) {
          return
        }

        this.subtitlesScheduler?.reset()

        setTimeout(() => {
          void this.handleNavigation()
        }, NAVIGATION_HANDLER_DELAY)
      }

      window.addEventListener(events.navigate, navigationListener)
    }
  }

  private async handleNavigation() {
    if (this.videoIdChanged) {
      this.resetForNavigation()
      void this.renderTranslateButton()

      await this.initializeScheduler()
      await this.tryAutoStartSubtitles()
    }
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
      this.cachedVideoId = currentVideoId

      const useSameTrack = await this.subtitlesFetcher.shouldUseSameTrack()

      if (useSameTrack) {
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

      this.translationCoordinator?.stop()
      this.translationCoordinator = null
      this.processedFragments = []
      this.segmentationPipeline = null
      this.subtitlesScheduler?.reset()

      if (!await this.subtitlesFetcher.hasAvailableSubtitles()) {
        this.subtitlesScheduler?.setState("error", { message: i18n.t("subtitles.errors.noSubtitlesFound") })
        if (analyticsContext) {
          void trackFeatureUsed({
            ...analyticsContext,
            outcome: "failure",
          })
        }
        return
      }

      this.subtitlesScheduler?.setState("loading")

      this.originalSubtitles = await this.subtitlesFetcher.fetch()

      if (this.originalSubtitles.length === 0) {
        this.subtitlesScheduler?.setState("error", { message: i18n.t("subtitles.errors.noSubtitlesFound") })
        if (analyticsContext) {
          void trackFeatureUsed({
            ...analyticsContext,
            outcome: "failure",
          })
        }
        return
      }

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
      subtitlesTextContent: this.originalSubtitles.map(f => f.text).join(""),
    }

    if (useAiSegmentation) {
      this.segmentationPipeline = new SegmentationPipeline({
        rawFragments: this.originalSubtitles,
        getVideoElement: () => this.subtitlesScheduler?.getVideoElement() ?? null,
        getSourceLanguage: () => this.subtitlesFetcher.getSourceLanguage(),
      })
    }
    else {
      this.processedFragments = optimizeSubtitles(
        this.originalSubtitles,
        this.subtitlesFetcher.getSourceLanguage(),
      )
    }

    this.translationCoordinator = new TranslationCoordinator({
      getFragments: () => this.segmentationPipeline
        ? this.segmentationPipeline.processedFragments
        : this.processedFragments,
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
