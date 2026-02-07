import type { SegmentationPipeline } from './segmentation-pipeline'
import type { SubtitlesVideoContext } from '@/utils/subtitles/processor/translator'
import type { SubtitlesFragment, SubtitlesState } from '@/utils/subtitles/types'
import { getLocalConfig } from '@/utils/config/storage'
import { TRANSLATE_LOOK_AHEAD_MS, TRANSLATION_BATCH_SIZE } from '@/utils/constants/subtitles'
import { translateSubtitles } from '@/utils/subtitles/processor/translator'

export interface TranslationCoordinatorOptions {
  getFragments: () => SubtitlesFragment[]
  getVideoElement: () => HTMLVideoElement | null
  segmentationPipeline: SegmentationPipeline | null
  onTranslated: (fragments: SubtitlesFragment[]) => void
  onStateChange: (state: SubtitlesState, data?: Record<string, string>) => void
}

export class TranslationCoordinator {
  private translatingStarts = new Set<number>()
  private translatedStarts = new Set<number>()
  private failedStarts = new Set<number>()
  private isTranslating = false
  private videoContext: SubtitlesVideoContext = { videoTitle: '', subtitlesTextContent: '' }

  private getFragments: () => SubtitlesFragment[]
  private getVideoElement: () => HTMLVideoElement | null
  private segmentationPipeline: SegmentationPipeline | null
  private onTranslated: (fragments: SubtitlesFragment[]) => void
  private onStateChange: (state: SubtitlesState, data?: Record<string, string>) => void

  constructor(options: TranslationCoordinatorOptions) {
    this.getFragments = options.getFragments
    this.getVideoElement = options.getVideoElement
    this.segmentationPipeline = options.segmentationPipeline
    this.onTranslated = options.onTranslated
    this.onStateChange = options.onStateChange
  }

  start(videoContext?: SubtitlesVideoContext) {
    if (videoContext !== undefined) {
      this.videoContext = videoContext
    }

    const video = this.getVideoElement()
    if (!video)
      return

    video.addEventListener('timeupdate', this.handleTranslationTick)
    video.addEventListener('seeked', this.handleTranslationTick)

    if (this.segmentationPipeline) {
      video.addEventListener('seeked', this.handleSeek)
      this.segmentationPipeline.start()
    }

    this.handleTranslationTick()
  }

  stop() {
    const video = this.getVideoElement()
    if (!video)
      return
    video.removeEventListener('timeupdate', this.handleTranslationTick)
    video.removeEventListener('seeked', this.handleTranslationTick)
    video.removeEventListener('seeked', this.handleSeek)
    this.segmentationPipeline?.stop()
  }

  reset() {
    this.translatingStarts.clear()
    this.translatedStarts.clear()
    this.failedStarts.clear()
    this.isTranslating = false
    this.videoContext = { videoTitle: '', subtitlesTextContent: '' }
  }

  clearFailed() {
    this.failedStarts.clear()
  }

  private handleTranslationTick = () => {
    const video = this.getVideoElement()
    if (!video)
      return

    // Heartbeat: ensure segmentation loop keeps running
    if (this.segmentationPipeline && !this.segmentationPipeline.isRunning
      && this.segmentationPipeline.hasUnprocessedChunks()) {
      const currentTimeMs = video.currentTime * 1000
      const fragments = this.segmentationPipeline.processedFragments
      const currentSub = fragments.find(f => f.start <= currentTimeMs && f.end > currentTimeMs)
      if (!currentSub || !this.translatedStarts.has(currentSub.start)) {
        this.onStateChange('segmenting')
      }
      this.segmentationPipeline.restart()
    }

    if (this.isTranslating)
      return
    void this.translateNearby(video.currentTime * 1000)
  }

  private async translateNearby(currentTimeMs: number) {
    const fragments = this.getFragments()

    const batch = fragments
      .filter(f => !this.translatedStarts.has(f.start)
        && !this.translatingStarts.has(f.start)
        && !this.failedStarts.has(f.start)
        && f.start >= currentTimeMs - 5000
        && f.start <= currentTimeMs + TRANSLATE_LOOK_AHEAD_MS)
      .slice(0, TRANSLATION_BATCH_SIZE)

    if (batch.length === 0)
      return

    const currentSub = fragments.find(f => f.start <= currentTimeMs && f.end > currentTimeMs)

    if (currentSub && !this.translatedStarts.has(currentSub.start)) {
      this.onStateChange('processing')
    }

    this.isTranslating = true
    batch.forEach(f => this.translatingStarts.add(f.start))

    try {
      const translated = await translateSubtitles(batch, this.videoContext)
      translated.forEach((f) => {
        this.translatingStarts.delete(f.start)
        this.translatedStarts.add(f.start)
      })
      this.onTranslated(translated)
      this.onStateChange('idle')
    }
    catch (error) {
      batch.forEach((f) => {
        this.translatingStarts.delete(f.start)
        this.failedStarts.add(f.start)
      })

      const config = await getLocalConfig()
      const displayMode = config?.videoSubtitles?.style.displayMode
      if (displayMode === 'translationOnly') {
        const fallback = batch.map(f => ({ ...f, translation: f.text }))
        this.onTranslated(fallback)
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      this.onStateChange('error', { message: errorMessage })
    }
    finally {
      this.isTranslating = false
    }
  }

  private handleSeek = () => {
    this.segmentationPipeline?.restart()
  }
}
