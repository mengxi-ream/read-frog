import type { SubtitlesFragment } from '../../types'
import type { SubtitlesFetcher } from '../types'
import type { SubtitlesInterceptMessage, YoutubeTimedText } from './types'
import { i18n } from '#imports'
import { getLocalConfig } from '@/utils/config/storage'
import { FETCH_SUBTITLES_TIMEOUT } from '@/utils/constants/subtitles'
import { OverlaySubtitlesError, ToastSubtitlesError } from '@/utils/subtitles/errors'
import { optimizeSubtitles } from '@/utils/subtitles/processor/optimizer'
import { detectFormat } from './format-detector'
import { parseKaraokeSubtitles, parseScrollingAsrSubtitles, parseStandardSubtitles } from './parser'
import { knownHttpErrorStatusSchema, subtitlesInterceptMessageSchema, youtubeSubtitlesResponseSchema } from './types'

export class YoutubeSubtitlesFetcher implements SubtitlesFetcher {
  private subtitles: SubtitlesFragment[] = []
  private rawEvents: YoutubeTimedText[] = []
  private sourceLanguage: string = ''
  private messageListener: ((event: MessageEvent) => void) | null = null

  private pendingResolve: ((subtitles: SubtitlesFragment[]) => void) | null = null
  private pendingReject: ((error: Error) => void) | null = null
  private timeoutId: ReturnType<typeof setTimeout> | null = null

  initialize(): void {
    this.setupMessageListener()
  }

  async fetch(): Promise<SubtitlesFragment[]> {
    if (this.subtitles.length > 0) {
      return this.subtitles
    }
    return new Promise<SubtitlesFragment[]>((resolve, reject) => {
      this.pendingResolve = resolve
      this.pendingReject = reject

      this.timeoutId = setTimeout(() => {
        if (this.pendingResolve) {
          this.clearPending()
          reject(new OverlaySubtitlesError(i18n.t('subtitles.errors.fetchSubTimeout')))
        }
      }, FETCH_SUBTITLES_TIMEOUT)

      this.clickYoutubeSubtitleButton()
    })
  }

  cleanup(): void {
    this.subtitles = []
    this.rawEvents = []
    this.clearPending()
  }

  private clearPending() {
    this.pendingResolve = null
    this.pendingReject = null
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  private rejectAndClearPending(error: Error) {
    this.pendingReject?.(error)
    this.clearPending()
  }

  private setupMessageListener() {
    this.messageListener = (event: MessageEvent) => {
      // Ignore unrelated postMessage traffic; only handle messages when we're actively waiting.
      if (!this.pendingResolve || event.origin !== window.location.origin) {
        return
      }

      const parsed = subtitlesInterceptMessageSchema.safeParse(event.data)
      if (!parsed.success) {
        return
      }

      this.subtitles = []
      this.rawEvents = []
      void this.handleInterceptedSubtitle(parsed.data)
    }

    window.addEventListener('message', this.messageListener)
  }

  private async handleInterceptedSubtitle(data: SubtitlesInterceptMessage) {
    if (data.errorStatus !== null) {
      const parsed = knownHttpErrorStatusSchema.safeParse(data.errorStatus)
      const errorMessage = parsed.success
        ? i18n.t(`subtitles.errors.http${parsed.data}`)
        : i18n.t('subtitles.errors.httpUnknown', [data.errorStatus])
      this.rejectAndClearPending(new OverlaySubtitlesError(errorMessage))
      return
    }

    if (!data.payload.trim()) {
      this.rejectAndClearPending(new OverlaySubtitlesError(i18n.t('subtitles.errors.noSubtitlesFound')))
      return
    }

    let payloadJson: unknown
    try {
      payloadJson = JSON.parse(data.payload)
    }
    catch {
      this.rejectAndClearPending(new OverlaySubtitlesError(i18n.t('subtitles.errors.invalidResponse')))
      return
    }

    const parsed = youtubeSubtitlesResponseSchema.safeParse(payloadJson)
    if (!parsed.success) {
      this.rejectAndClearPending(new OverlaySubtitlesError(i18n.t('subtitles.errors.invalidResponse')))
      return
    }

    this.rawEvents = parsed.data.events
    this.sourceLanguage = data.lang

    this.subtitles = await this.processRawEvents(this.rawEvents)
    this.pendingResolve?.(this.subtitles)
    this.clearPending()
  }

  private async processRawEvents(events: YoutubeTimedText[]): Promise<SubtitlesFragment[]> {
    const config = await getLocalConfig()
    const enableAISegmentation = config?.videoSubtitles?.aiSegmentation ?? false
    const format = detectFormat(events)

    // Karaoke format: dedicated parser
    if (format === 'karaoke') {
      return parseKaraokeSubtitles(events)
    }

    // AI segmentation: needs raw word-level fragments, skip optimization
    if (enableAISegmentation) {
      return parseStandardSubtitles(events)
    }

    // Traditional path: format-specific parsing + optimization
    const fragments = format === 'scrolling-asr'
      ? parseScrollingAsrSubtitles(events, this.sourceLanguage)
      : parseStandardSubtitles(events)

    return optimizeSubtitles(fragments, this.sourceLanguage)
  }

  private clickYoutubeSubtitleButton() {
    const ccButton = document.querySelector('.ytp-subtitles-button')
    if (!(ccButton instanceof HTMLElement)) {
      this.rejectAndClearPending(new ToastSubtitlesError(i18n.t('subtitles.errors.buttonNotFound')))
      return
    }

    const isDisabled = ccButton.getAttribute('aria-disabled') === 'true'
      || ccButton.getAttribute('disabled') !== null
      || (ccButton instanceof HTMLButtonElement && ccButton.disabled)

    if (isDisabled) {
      this.rejectAndClearPending(new OverlaySubtitlesError(i18n.t('subtitles.errors.noSubtitlesFound')))
      return
    }

    const isPressed = ccButton.getAttribute('aria-pressed') === 'true'
    if (isPressed) {
      ccButton.click()
      ccButton.click()
    }
    else {
      ccButton.click()
    }
  }
}
