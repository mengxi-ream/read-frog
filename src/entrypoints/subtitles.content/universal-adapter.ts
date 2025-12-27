import type { PlatformConfig } from '@/entrypoints/subtitles.content/platforms'
import type { SubtitlesFetcher } from '@/utils/subtitles/fetchers/types'
import type { SubtitlesFragment, TranslationBatch } from '@/utils/subtitles/types'
import { i18n } from '#imports'
import { toast } from 'sonner'
import { HIDE_NATIVE_CAPTIONS_STYLE_ID, NAVIGATION_HANDLER_DELAY, PRELOAD_AHEAD_MS, TRANSLATE_BUTTON_CONTAINER_ID } from '@/utils/constants/subtitles'
import { waitForElement } from '@/utils/dom/wait-for-element'
import { ToastSubtitlesError } from '@/utils/subtitles/errors'
import { createBatches, findNextBatchToTranslate, updateBatchState } from '@/utils/subtitles/processor/batch-strategy'
import { translateSubtitles } from '@/utils/subtitles/processor/translator'
import { currentSubtitleAtom, currentTranslatingBatchIdAtom, subtitlesStore, translationBatchesAtom } from './atoms'
import { renderSubtitlesTranslateButton } from './renderer/render-translate-button'
import { SubtitlesScheduler } from './subtitles-scheduler'

export class UniversalVideoAdapter {
  private config: PlatformConfig
  private subtitlesScheduler: SubtitlesScheduler | null = null
  private subtitlesFetcher: SubtitlesFetcher

  private originalSubtitles: SubtitlesFragment[] = []
  private isNativeSubtitlesHidden = false
  private cachedVideoId: string | null = null

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
    this.subtitlesFetcher.initialize()
    void this.initializeScheduler()
    void this.renderTranslateButton()
    this.setupNavigationListener()
  }

  private resetSubtitlesData() {
    this.subtitlesScheduler?.reset()
    this.stopBatchMonitoring()
    subtitlesStore.set(translationBatchesAtom, [])
    subtitlesStore.set(currentTranslatingBatchIdAtom, null)
    this.originalSubtitles = []
    this.subtitlesFetcher.cleanup()
  }

  private resetForNavigation() {
    this.destroyScheduler()
    this.originalSubtitles = []
    this.cachedVideoId = null
    this.subtitlesFetcher.cleanup()
    this.showNativeSubtitles()
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
      toast.error(i18n.t('subtitles.errors.videoNotFound'))
      return
    }

    this.subtitlesScheduler = new SubtitlesScheduler({ videoElement: video })
    this.subtitlesScheduler.start()
    this.subtitlesScheduler.hide()
  }

  private setupNavigationListener() {
    const { navigation } = this.config

    if (navigation.event) {
      const navigationListener = () => {
        setTimeout(() => {
          this.handleNavigation()
        }, NAVIGATION_HANDLER_DELAY)
      }

      window.addEventListener(navigation.event, navigationListener)
    }
  }

  private handleNavigation() {
    const currentVideoId = this.config.navigation.getVideoId?.()
    if (currentVideoId && this.cachedVideoId && currentVideoId !== this.cachedVideoId) {
      this.resetForNavigation()
      void this.initializeScheduler()
      void this.renderTranslateButton()
    }
  }

  private async renderTranslateButton() {
    const controlsBar = await waitForElement(this.config.selectors.controlsBar)
    if (!controlsBar) {
      toast.error(i18n.t('subtitles.errors.controlsBarNotFound'))
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
      this.resetSubtitlesData()
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

    const style = document.createElement('style')
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
      const currentVideoId = this.config.navigation.getVideoId?.() ?? ''
      this.cachedVideoId = currentVideoId
      this.subtitlesScheduler?.setState('fetching')

      this.originalSubtitles = await this.subtitlesFetcher.fetch()

      this.subtitlesScheduler?.setState('fetchSuccess')

      if (this.originalSubtitles.length === 0) {
        this.subtitlesScheduler?.setState('error', { message: i18n.t('subtitles.errors.noSubtitlesFound') })
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
        this.subtitlesScheduler?.setState('error', { message: errorMessage })
      }
    }
  }

  private async processSubtitles() {
    try {
      this.subtitlesScheduler?.setState('processing')

      const batches = createBatches(this.originalSubtitles)
      subtitlesStore.set(translationBatchesAtom, batches)

      const video = this.subtitlesScheduler?.getVideoElement()
      const currentTimeMs = (video?.currentTime ?? 0) * 1000
      const firstBatchToTranslate = findNextBatchToTranslate(batches, currentTimeMs, PRELOAD_AHEAD_MS)

      if (firstBatchToTranslate) {
        await this.translateBatch(firstBatchToTranslate)
      }

      this.startBatchMonitoring()
    }
    catch {
      this.subtitlesScheduler?.supplementSubtitles(
        this.originalSubtitles.map(f => ({ ...f, translation: '' })),
      )
    }
    finally {
      this.subtitlesScheduler?.setState('idle')
    }
  }

  private async translateBatch(batch: TranslationBatch) {
    const batches = subtitlesStore.get(translationBatchesAtom)
    subtitlesStore.set(translationBatchesAtom, updateBatchState(batches, batch.id, 'processing'))
    subtitlesStore.set(currentTranslatingBatchIdAtom, batch.id)

    // Only show processing state when there's no current subtitle
    const currentSubtitle = subtitlesStore.get(currentSubtitleAtom)
    if (!currentSubtitle) {
      this.subtitlesScheduler?.setState('processing')
    }

    try {
      const translated = await translateSubtitles(batch.fragments)

      const updatedBatches = subtitlesStore.get(translationBatchesAtom)
      subtitlesStore.set(translationBatchesAtom, updateBatchState(updatedBatches, batch.id, 'completed'))

      this.subtitlesScheduler?.supplementSubtitles(translated)
    }
    catch {
      const updatedBatches = subtitlesStore.get(translationBatchesAtom)
      subtitlesStore.set(translationBatchesAtom, updateBatchState(updatedBatches, batch.id, 'error'))

      this.subtitlesScheduler?.supplementSubtitles(
        batch.fragments.map(f => ({ ...f, translation: '' })),
      )
    }
    finally {
      subtitlesStore.set(currentTranslatingBatchIdAtom, null)
      this.subtitlesScheduler?.setState('idle')
    }
  }

  private handleBatchCheck = () => {
    const video = this.subtitlesScheduler?.getVideoElement()
    if (!video)
      return

    const currentTimeMs = video.currentTime * 1000
    const batches = subtitlesStore.get(translationBatchesAtom)
    const currentTranslating = subtitlesStore.get(currentTranslatingBatchIdAtom)

    if (currentTranslating !== null)
      return

    const nextBatch = findNextBatchToTranslate(batches, currentTimeMs, PRELOAD_AHEAD_MS)
    if (nextBatch) {
      void this.translateBatch(nextBatch)
    }
  }

  private startBatchMonitoring() {
    const video = this.subtitlesScheduler?.getVideoElement()
    if (!video)
      return

    video.addEventListener('seeking', this.handleBatchCheck)
    video.addEventListener('timeupdate', this.handleBatchCheck)
  }

  private stopBatchMonitoring() {
    const video = this.subtitlesScheduler?.getVideoElement()
    if (!video)
      return

    video.removeEventListener('seeking', this.handleBatchCheck)
    video.removeEventListener('timeupdate', this.handleBatchCheck)
  }
}
