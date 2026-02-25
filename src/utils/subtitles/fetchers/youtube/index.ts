import type { SubtitlesFragment } from "../../types"
import type { SubtitlesFetcher } from "../types"
import type { CaptionTrack, PlayerData, YoutubeTimedText } from "./types"
import { i18n } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import {
  ENSURE_SUBTITLES_REQUEST_TYPE,
  ENSURE_SUBTITLES_RESPONSE_TYPE,
  FETCH_RETRY_DELAY_MS,
  MAX_FETCH_RETRIES,
  MAX_POT_WAIT_ATTEMPTS,
  MAX_STATE_WAIT_ATTEMPTS,
  PLAYER_DATA_REQUEST_TYPE,
  PLAYER_DATA_RESPONSE_TYPE,
  POST_MESSAGE_TIMEOUT_MS,
  POT_WAIT_INTERVAL_MS,
  STATE_WAIT_INTERVAL_MS,
  WAIT_TIMEDTEXT_REQUEST_TYPE,
  WAIT_TIMEDTEXT_RESPONSE_TYPE,
} from "@/utils/constants/subtitles"
import { OverlaySubtitlesError } from "@/utils/subtitles/errors"
import { optimizeSubtitles } from "@/utils/subtitles/processor/optimizer"
import { getYoutubeVideoId } from "@/utils/subtitles/video-id"
import { detectFormat } from "./format-detector"
import { filterNoiseFromEvents } from "./noise-filter"
import { parseKaraokeSubtitles, parseScrollingAsrSubtitles, parseStandardSubtitles } from "./parser"
import { extractPotToken } from "./pot-token"
import { youtubeSubtitlesResponseSchema } from "./types"
import { buildSubtitleUrl } from "./url-builder"

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function postMessageRequest(
  responseType: string,
  message: Record<string, unknown>,
): Promise<any> {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID()

    const handler = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin
        || event.data?.type !== responseType
        || event.data?.requestId !== requestId
      ) {
        return
      }

      window.removeEventListener("message", handler)
      resolve(event.data)
    }

    window.addEventListener("message", handler)
    window.postMessage({ ...message, requestId }, window.location.origin)

    setTimeout(() => {
      window.removeEventListener("message", handler)
      resolve(null)
    }, POST_MESSAGE_TIMEOUT_MS)
  })
}

export class YoutubeSubtitlesFetcher implements SubtitlesFetcher {
  private subtitles: SubtitlesFragment[] = []
  private sourceLanguage: string = ""
  private cachedTrackHash: string | null = null

  async fetch(): Promise<SubtitlesFragment[]> {
    const videoId = getYoutubeVideoId()
    if (!videoId) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.videoNotFound"))
    }

    const currentHash = await this.computeTrackHash()

    if (currentHash && this.subtitles.length > 0 && this.cachedTrackHash === currentHash) {
      return this.subtitles
    }

    // Wait for player state >= 1 (video ready) BEFORE getting POT
    // YouTube only makes timedtext XHR request when video is ready to play
    await this.waitForPlayerState(videoId)

    const playerData = await this.getPlayerDataWithPot(videoId)

    const track = this.selectTrack(playerData.captionTracks, playerData.selectedTrackLanguageCode)
    if (!track) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }

    const potToken = extractPotToken(track, playerData)
    const url = buildSubtitleUrl(track, playerData, potToken)
    const events = await this.fetchWithRetry(url)

    this.sourceLanguage = track.languageCode
    this.subtitles = await this.processRawEvents(events)
    this.cachedTrackHash = currentHash

    return this.subtitles
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  cleanup(): void {
    this.subtitles = []
    this.sourceLanguage = ""
    this.cachedTrackHash = null
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    const videoId = getYoutubeVideoId()
    if (!videoId) {
      return false
    }

    const response = await this.requestPlayerData(videoId)
    return response.success === true
      && response.data != null
      && response.data.captionTracks.length > 0
  }

  async shouldUseSameTrack(): Promise<boolean> {
    if (this.subtitles.length === 0 || !this.cachedTrackHash) {
      return false
    }

    try {
      const currentHash = await this.computeTrackHash()
      return currentHash !== null && this.cachedTrackHash === currentHash
    }
    catch {
      return false
    }
  }

  private async computeTrackHash(): Promise<string | null> {
    const videoId = getYoutubeVideoId()
    if (!videoId) {
      return null
    }

    const response = await this.requestPlayerData(videoId)
    if (!response.success || !response.data) {
      return null
    }

    const track = this.selectTrack(response.data.captionTracks, response.data.selectedTrackLanguageCode)
    if (!track) {
      return null
    }

    return `${videoId}:${track.languageCode}:${track.kind ?? ""}:${track.vssId}`
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

  private async getPlayerDataWithPot(videoId: string): Promise<PlayerData> {
    const response = await this.requestPlayerData(videoId)

    if (!response.success || !response.data) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.fetchSubTimeout"))
    }

    let playerData = response.data

    if (this.hasPotInAudioTracks(playerData) || playerData.cachedTimedtextUrl) {
      return playerData
    }

    if (playerData.captionTracks.length === 0) {
      return playerData
    }

    await this.ensureSubtitlesEnabled()

    for (let i = 0; i < MAX_POT_WAIT_ATTEMPTS; i++) {
      await sleep(POT_WAIT_INTERVAL_MS)
      const pollResponse = await this.requestPlayerData(videoId)
      if (pollResponse.success && pollResponse.data) {
        playerData = pollResponse.data
        if (this.hasPotInAudioTracks(playerData) || playerData.cachedTimedtextUrl) {
          return playerData
        }
      }
    }

    const timedtextUrl = await this.waitForTimedtextUrl(videoId)
    if (timedtextUrl) {
      playerData.cachedTimedtextUrl = timedtextUrl
    }

    return playerData
  }

  private hasPotInAudioTracks(playerData: PlayerData): boolean {
    return playerData.audioCaptionTracks.some((t) => {
      try {
        return new URL(t.url).searchParams.has("pot")
      }
      catch {
        return false
      }
    })
  }

  private async waitForTimedtextUrl(videoId: string): Promise<string | null> {
    const resp = await postMessageRequest(
      WAIT_TIMEDTEXT_RESPONSE_TYPE,
      { type: WAIT_TIMEDTEXT_REQUEST_TYPE, videoId },
    )
    return resp?.url ?? null
  }

  private async requestPlayerData(videoId: string): Promise<{
    success: boolean
    error?: string
    data?: PlayerData
  }> {
    const resp = await postMessageRequest(
      PLAYER_DATA_RESPONSE_TYPE,
      { type: PLAYER_DATA_REQUEST_TYPE, expectedVideoId: videoId },
    )
    if (!resp)
      return { success: false, error: "TIMEOUT" }
    return { success: resp.success, error: resp.error, data: resp.data }
  }

  private async ensureSubtitlesEnabled(): Promise<void> {
    await postMessageRequest(
      ENSURE_SUBTITLES_RESPONSE_TYPE,
      { type: ENSURE_SUBTITLES_REQUEST_TYPE },
    )
  }

  /**
   * Select the best subtitle track from available tracks.
   *
   * Priority order:
   * 1. User's currently selected track in YouTube player (if available)
   * 2. Human-created subtitles without name (original language, highest quality)
   * 3. Human-created subtitles with name (may be translated versions)
   * 4. Auto-generated ASR subtitles (lower quality but better than nothing)
   * 5. First available track as fallback
   */
  private selectTrack(tracks: CaptionTrack[], selectedLanguageCode: string | null): CaptionTrack | null {
    if (tracks.length === 0)
      return null

    // Priority 1: User's selected track in YouTube player
    if (selectedLanguageCode) {
      const selectedTrack = tracks.find(t => t.languageCode === selectedLanguageCode)
      if (selectedTrack)
        return selectedTrack
    }

    // Priority 2: Human subtitles without name - these are typically the original
    // language subtitles uploaded by the video creator
    const humanExact = tracks.find(t => t.kind !== "asr" && !t.name)
    if (humanExact)
      return humanExact

    // Priority 3: Human subtitles with name - may be translated or have additional metadata
    const humanWithName = tracks.find(t => t.kind !== "asr")
    if (humanWithName)
      return humanWithName

    // Priority 4: Auto-generated speech recognition subtitles
    const asr = tracks.find(t => t.kind === "asr")
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
            // Permanent errors - don't retry
            case 403:
              throw new OverlaySubtitlesError(i18n.t("subtitles.errors.http403"))
            case 404:
              throw new OverlaySubtitlesError(i18n.t("subtitles.errors.http404"))
            case 429:
              throw new OverlaySubtitlesError(i18n.t("subtitles.errors.http429"))
            // Retryable errors - throw and let retry logic handle
            case 500:
              throw new Error(`${i18n.t("subtitles.errors.http500")}`)
            default:
              throw new Error(`${i18n.t("subtitles.errors.httpUnknown", [status])}`)
          }
        }

        const data = await response.json()
        const parsed = youtubeSubtitlesResponseSchema.safeParse(data)
        if (!parsed.success) {
          throw new Error("Invalid response format")
        }

        return parsed.data.events
      }
      catch (e) {
        // Don't retry permanent errors (OverlaySubtitlesError)
        if (e instanceof OverlaySubtitlesError) {
          throw e
        }
        lastError = e instanceof Error ? e : new Error(String(e))
        if (i < MAX_FETCH_RETRIES - 1) {
          await sleep(FETCH_RETRY_DELAY_MS)
        }
      }
    }

    throw new OverlaySubtitlesError(lastError?.message ?? i18n.t("subtitles.errors.fetchSubTimeout"))
  }

  private async processRawEvents(events: YoutubeTimedText[]): Promise<SubtitlesFragment[]> {
    const config = await getLocalConfig()
    const enableAISegmentation = config?.videoSubtitles?.aiSegmentation ?? false

    const filteredEvents = filterNoiseFromEvents(events)
    const format = detectFormat(filteredEvents)

    if (format === "karaoke") {
      return parseKaraokeSubtitles(filteredEvents)
    }

    if (enableAISegmentation) {
      return parseStandardSubtitles(filteredEvents)
    }

    const fragments = format === "scrolling-asr"
      ? parseScrollingAsrSubtitles(filteredEvents, this.sourceLanguage)
      : parseStandardSubtitles(filteredEvents)

    return optimizeSubtitles(fragments, this.sourceLanguage)
  }
}
