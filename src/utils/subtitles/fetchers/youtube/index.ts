import type { SubtitlesFragment } from '../../types'
import type { SubtitlesFetcher } from '../types'
import type { SubtitlesInterceptMessage, YoutubeTimedText } from './types'
import { i18n } from '#imports'
import { FETCH_SUBTITLES_TIMEOUT } from '@/utils/constants/subtitles'
import { OverlaySubtitlesError, ToastSubtitlesError } from '@/utils/subtitles/errors'
import { optimizeSubtitles } from '@/utils/subtitles/processor/optimizer'
import { detectFormat } from './format-detector'
import { parseKaraokeSubtitles, parseScrollingAsrSubtitles, parseStandardSubtitles } from './parser'
import { subtitlesInterceptMessageSchema, youtubeSubtitlesResponseSchema } from './types'

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

    this.clickYoutubeSubtitleButton()

    return new Promise<SubtitlesFragment[]>((resolve, reject) => {
      this.pendingResolve = resolve
      this.pendingReject = reject

      this.timeoutId = setTimeout(() => {
        if (this.pendingResolve) {
          this.clearPending()
          reject(new OverlaySubtitlesError(i18n.t('subtitles.errors.fetchSubTimeout')))
        }
      }, FETCH_SUBTITLES_TIMEOUT)
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
      const parsed = subtitlesInterceptMessageSchema.safeParse(event.data)
      if (!parsed.success) {
        this.rejectAndClearPending(new OverlaySubtitlesError(i18n.t('subtitles.errors.invalidResponse')))
        return
      }

      this.subtitles = []
      this.rawEvents = []
      this.handleInterceptedSubtitle(parsed.data)
    }

    window.addEventListener('message', this.messageListener)
  }

  private handleInterceptedSubtitle(data: SubtitlesInterceptMessage) {
    if (data.errorStatus) {
      this.rejectAndClearPending(new OverlaySubtitlesError(i18n.t(`subtitles.errors.http${data.errorStatus}`)))
      return
    }

    const parsed = youtubeSubtitlesResponseSchema.safeParse(JSON.parse(data.payload))
    if (!parsed.success) {
      this.rejectAndClearPending(new OverlaySubtitlesError(i18n.t('subtitles.errors.invalidResponse')))
      return
    }

    this.rawEvents = parsed.data.events
    this.sourceLanguage = data.lang

    this.subtitles = this.processRawEvents(this.rawEvents)
    this.pendingResolve?.(this.subtitles)
    this.clearPending()
  }

  private processRawEvents(events: YoutubeTimedText[]): SubtitlesFragment[] {
    const format = detectFormat(events)

    switch (format) {
      case 'karaoke':
        return parseKaraokeSubtitles(events)
      case 'scrolling-asr':
      {
        const fragments = parseScrollingAsrSubtitles(events, this.sourceLanguage)
        return optimizeSubtitles(fragments, this.sourceLanguage)
      }
      default:
      {
        const fragments = parseStandardSubtitles(events)
        return optimizeSubtitles(fragments, this.sourceLanguage)
      }
    }
  }

  private clickYoutubeSubtitleButton() {
    const ccButton = document.querySelector('.ytp-subtitles-button')
    if (!(ccButton instanceof HTMLElement)) {
      this.rejectAndClearPending(new ToastSubtitlesError(i18n.t('subtitles.errors.buttonNotFound')))
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
