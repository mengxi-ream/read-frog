import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import type { SubtitlesFetcher } from "@/utils/subtitles/fetchers/types"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { i18n } from "#imports"
import { toast } from "sonner"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_SUBTITLE_POSITION, HIDE_NATIVE_CAPTIONS_STYLE_ID, NAVIGATION_HANDLER_DELAY, TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { waitForElement } from "@/utils/dom/wait-for-element"
import { ToastSubtitlesError } from "@/utils/subtitles/errors"
import { subtitlesPositionAtom, subtitlesStore } from "./atoms"
import { renderSubtitlesTranslateButton } from "./renderer/render-translate-button"
import { SegmentationPipeline } from "./segmentation-pipeline"
import { SubtitlesScheduler } from "./subtitles-scheduler"
import { TranslationCoordinator } from "./translation-coordinator"

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

  initialize() {
    void this.initializeScheduler()
    void this.renderTranslateButton()
    this.setupNavigationListener()
  }

  private resetForNavigation() {
    this.destroyScheduler()
    this.translationCoordinator?.stop()
    this.translationCoordinator = null
    this.processedFragments = []
    this.segmentationPipeline = null
    this.originalSubtitles = []
    this.cachedVideoId = null
    this.subtitlesFetcher.cleanup()
    this.showNativeSubtitles()
    subtitlesStore.set(subtitlesPositionAtom, DEFAULT_SUBTITLE_POSITION)
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
      await this.initializeScheduler()
      void this.renderTranslateButton()
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

    const toggleButton = renderSubtitlesTranslateButton(
      enabled => this.handleToggleSubtitles(enabled),
    )

    controlsBar.insertBefore(toggleButton, controlsBar.firstChild)
  }

  private handleToggleSubtitles(enabled: boolean) {
    if (enabled) {
      this.subtitlesScheduler?.start()
      this.subtitlesScheduler?.show()
      this.hideNativeSubtitles()
      void this.startTranslation()
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

  private async startTranslation() {
    try {
      const currentVideoId = this.config.getVideoId?.() ?? ""
      this.cachedVideoId = currentVideoId

      const useSameTrack = await this.subtitlesFetcher.shouldUseSameTrack()

      if (useSameTrack) {
        // Clear failed states to allow retry on resume
        this.translationCoordinator?.clearFailed()
        this.segmentationPipeline?.clearFailedStarts()
        this.translationCoordinator?.start()
        return
      }

      this.translationCoordinator?.stop()
      this.translationCoordinator = null
      this.processedFragments = []
      this.segmentationPipeline = null
      this.subtitlesScheduler?.reset()

      if (!await this.subtitlesFetcher.hasAvailableSubtitles()) {
        this.subtitlesScheduler?.setState("error", { message: i18n.t("subtitles.errors.noSubtitlesFound") })
        return
      }

      this.subtitlesScheduler?.setState("loading")

      this.originalSubtitles = await this.subtitlesFetcher.fetch()

      if (this.originalSubtitles.length === 0) {
        this.subtitlesScheduler?.setState("error", { message: i18n.t("subtitles.errors.noSubtitlesFound") })
        return
      }

      await this.processSubtitles()
    }
    catch (error) {
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

    const videoContext = {
      videoTitle: document.title || "",
      subtitlesTextContent: this.originalSubtitles.map(f => f.text).join(""),
    }

    if (useAiSegmentation) {
      this.segmentationPipeline = new SegmentationPipeline({
        rawFragments: this.originalSubtitles,
        getVideoElement: () => scheduler?.getVideoElement() ?? null,
        getSourceLanguage: () => this.subtitlesFetcher.getSourceLanguage(),
      })
    }
    else {
      this.processedFragments = this.originalSubtitles
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
  }
}
