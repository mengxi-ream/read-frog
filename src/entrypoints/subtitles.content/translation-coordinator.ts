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
  private lastEmittedState: SubtitlesState = 'idle'
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
    this.lastEmittedState = 'idle'
    this.videoContext = { videoTitle: '', subtitlesTextContent: '' }
  }

  clearFailed() {
    this.failedStarts.clear()
  }

  private handleTranslationTick = () => {
    const video = this.getVideoElement()
    if (!video)
      return

    const currentTimeMs = video.currentTime * 1000
    const fragments = this.getFragments()

    this.updateLoadingStateAt(currentTimeMs, fragments)

    if (this.segmentationPipeline && !this.segmentationPipeline.isRunning
      && this.segmentationPipeline.hasUnprocessedChunks()) {
      this.segmentationPipeline.restart()
    }

    if (this.isTranslating)
      return
    void this.translateNearby(currentTimeMs)
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

    if (batch.length === 0) {
      return
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

      const latestTimeMs = this.getCurrentVideoTimeMs(currentTimeMs)
      const latestFragments = this.getFragments()
      this.updateLoadingStateAt(latestTimeMs, latestFragments)
    }
    catch (error) {
      batch.forEach((f) => {
        this.translatingStarts.delete(f.start)
        this.failedStarts.add(f.start)
      })

      const config = await getLocalConfig()
      const displayMode = config?.videoSubtitles?.style.displayMode
      const fallback = displayMode === 'translationOnly'
        ? batch.map(f => ({ ...f, translation: f.text }))
        : batch.map(f => ({ ...f, translation: '' }))
      this.onTranslated(fallback)

      const errorMessage = error instanceof Error ? error.message : String(error)
      this.lastEmittedState = 'error'
      this.onStateChange('error', { message: errorMessage })
    }
    finally {
      this.isTranslating = false
    }
  }

  private getCurrentVideoTimeMs(fallbackTimeMs: number): number {
    const video = this.getVideoElement()
    if (!video) {
      return fallbackTimeMs
    }
    return video.currentTime * 1000
  }

  private findActiveCue(
    timeMs: number,
    fragments: SubtitlesFragment[],
  ): SubtitlesFragment | null {
    return fragments.find(f => f.start <= timeMs && f.end > timeMs) ?? null
  }

  private updateLoadingStateAt(timeMs: number, fragments: SubtitlesFragment[]) {
    const activeCue = this.findActiveCue(timeMs, fragments)

    const nextState: SubtitlesState = activeCue && !this.translatedStarts.has(activeCue.start)
      ? 'loading'
      : 'idle'

    if (nextState === this.lastEmittedState)
      return

    this.lastEmittedState = nextState
    this.onStateChange(nextState)
  }

  private handleSeek = () => {
    this.segmentationPipeline?.restart()
  }
}
