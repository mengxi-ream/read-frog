import type { SubtitlesFragment } from '../../types'
import type { SubtitlesFetcher } from '../types'
import type { CaptionTrack, PlayerData, YoutubeTimedText } from './types'
import { i18n } from '#imports'
import { getLocalConfig } from '@/utils/config/storage'
import {
  FETCH_RETRY_DELAY_MS,
  MAX_FETCH_RETRIES,
  MAX_PLAYER_WAIT_ATTEMPTS,
  MAX_STATE_WAIT_ATTEMPTS,
  PLAYER_DATA_REQUEST_TIMEOUT_MS,
  PLAYER_DATA_REQUEST_TYPE,
  PLAYER_DATA_RESPONSE_TYPE,
  PLAYER_WAIT_INTERVAL_MS,
  STATE_WAIT_INTERVAL_MS,
} from '@/utils/constants/subtitles'
import { OverlaySubtitlesError } from '@/utils/subtitles/errors'
import { optimizeSubtitles } from '@/utils/subtitles/processor/optimizer'
import { getYoutubeVideoId } from '@/utils/subtitles/video-id'
import { detectFormat } from './format-detector'
import { parseKaraokeSubtitles, parseScrollingAsrSubtitles, parseStandardSubtitles } from './parser'
import { extractPotToken } from './pot-token'
import { youtubeSubtitlesResponseSchema } from './types'
import { buildSubtitleUrl } from './url-builder'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class YoutubeSubtitlesFetcher implements SubtitlesFetcher {
  private subtitles: SubtitlesFragment[] = []
  private sourceLanguage: string = ''

  async fetch(): Promise<SubtitlesFragment[]> {
    if (this.subtitles.length > 0) {
      return this.subtitles
    }

    const videoId = getYoutubeVideoId()
    if (!videoId) {
      throw new OverlaySubtitlesError(i18n.t('subtitles.errors.videoNotFound'))
    }

    const playerData = await this.waitForPlayerData(videoId)

    if (playerData.playerState < 1) {
      await this.waitForPlayerState(videoId)
    }

    const track = this.selectTrack(playerData.captionTracks)
    if (!track) {
      throw new OverlaySubtitlesError(i18n.t('subtitles.errors.noSubtitlesFound'))
    }

    const potToken = extractPotToken(track, playerData)
    const url = buildSubtitleUrl(track, playerData, potToken)
    const events = await this.fetchWithRetry(url)

    this.sourceLanguage = track.languageCode
    this.subtitles = await this.processRawEvents(events)

    return this.subtitles
  }

  cleanup(): void {
    this.subtitles = []
    this.sourceLanguage = ''
  }

  private async waitForPlayerData(videoId: string): Promise<PlayerData> {
    for (let i = 0; i < MAX_PLAYER_WAIT_ATTEMPTS; i++) {
      const response = await this.requestPlayerData(videoId)

      if (response.success && response.data) {
        return response.data
      }

      if (response.error === 'VIDEO_ID_MISMATCH' || response.error === 'PLAYER_NOT_FOUND') {
        await sleep(PLAYER_WAIT_INTERVAL_MS)
        continue
      }

      throw new OverlaySubtitlesError(i18n.t('subtitles.errors.fetchSubTimeout'))
    }

    throw new OverlaySubtitlesError(i18n.t('subtitles.errors.fetchSubTimeout'))
  }

  private async waitForPlayerState(videoId: string): Promise<void> {
    for (let i = 0; i < MAX_STATE_WAIT_ATTEMPTS; i++) {
      const response = await this.requestPlayerData(videoId)

      if (response.success && response.data && response.data.playerState >= 1) {
        return
      }

      await sleep(STATE_WAIT_INTERVAL_MS)
    }
  }

  private requestPlayerData(videoId: string): Promise<{
    success: boolean
    error?: string
    data?: PlayerData
  }> {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2)

      const handler = (event: MessageEvent) => {
        if (
          event.origin !== window.location.origin
          || event.data?.type !== PLAYER_DATA_RESPONSE_TYPE
          || event.data?.requestId !== requestId
        ) {
          return
        }

        window.removeEventListener('message', handler)
        resolve({
          success: event.data.success,
          error: event.data.error,
          data: event.data.data,
        })
      }

      window.addEventListener('message', handler)

      window.postMessage(
        {
          type: PLAYER_DATA_REQUEST_TYPE,
          requestId,
          expectedVideoId: videoId,
        },
        window.location.origin,
      )

      setTimeout(() => {
        window.removeEventListener('message', handler)
        resolve({ success: false, error: 'TIMEOUT' })
      }, PLAYER_DATA_REQUEST_TIMEOUT_MS)
    })
  }

  private selectTrack(tracks: CaptionTrack[]): CaptionTrack | null {
    if (tracks.length === 0)
      return null

    const humanExact = tracks.find(t => t.kind !== 'asr' && !t.name)
    if (humanExact)
      return humanExact

    const humanWithName = tracks.find(t => t.kind !== 'asr')
    if (humanWithName)
      return humanWithName

    const asr = tracks.find(t => t.kind === 'asr')
    if (asr)
      return asr

    return tracks[0]
  }

  private async fetchWithRetry(url: string): Promise<YoutubeTimedText[]> {
    let lastError: Error | null = null

    for (let i = 0; i < MAX_FETCH_RETRIES; i++) {
      try {
        const response = await fetch(url)

        if (!response.ok) {
          const status = response.status
          switch (status) {
            case 403:
              throw new OverlaySubtitlesError(i18n.t('subtitles.errors.http403'))
            case 404:
              throw new OverlaySubtitlesError(i18n.t('subtitles.errors.http404'))
            case 429:
              throw new OverlaySubtitlesError(i18n.t('subtitles.errors.http429'))
            case 500:
              throw new OverlaySubtitlesError(i18n.t('subtitles.errors.http500'))
            default:
              throw new OverlaySubtitlesError(i18n.t('subtitles.errors.httpUnknown', [status]))
          }
        }

        const data = await response.json()
        const parsed = youtubeSubtitlesResponseSchema.safeParse(data)
        if (!parsed.success) {
          throw new Error('Invalid response format')
        }

        return parsed.data.events
      }
      catch (e) {
        lastError = e as Error
        if (i < MAX_FETCH_RETRIES - 1) {
          await sleep(FETCH_RETRY_DELAY_MS)
        }
      }
    }

    throw lastError ?? new OverlaySubtitlesError(i18n.t('subtitles.errors.fetchSubTimeout'))
  }

  private async processRawEvents(events: YoutubeTimedText[]): Promise<SubtitlesFragment[]> {
    const config = await getLocalConfig()
    const enableAISegmentation = config?.videoSubtitles?.aiSegmentation ?? false
    const format = detectFormat(events)

    if (format === 'karaoke') {
      return parseKaraokeSubtitles(events)
    }

    if (enableAISegmentation) {
      return parseStandardSubtitles(events)
    }

    const fragments = format === 'scrolling-asr'
      ? parseScrollingAsrSubtitles(events, this.sourceLanguage)
      : parseStandardSubtitles(events)

    return optimizeSubtitles(fragments, this.sourceLanguage)
  }
}
