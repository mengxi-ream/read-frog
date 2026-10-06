import type { SubtitlesFetcher } from "../types"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { z } from "zod"
import {
  NETFLIX_LOAD_POST_MESSAGE_TIMEOUT_MS,
  NETFLIX_SUBTITLES_REQUEST_TYPE,
  NETFLIX_SUBTITLES_RESPONSE_TYPE,
  POST_MESSAGE_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { OverlaySubtitlesError } from "@/utils/subtitles/errors"
import { postMessageRequest } from "../post-message-request"
import { parseNetflixTtml } from "./ttml"

export type NetflixSubtitlesAction = "state" | "load" | "restore"

const netflixSubtitlesResponseSchema = z.object({
  type: z.string(),
  requestId: z.string(),
  movieId: z.number().nullable(),
  trackId: z.string().nullable(),
  translatable: z.boolean(),
  ttml: z.string().nullable(),
})

export type NetflixSubtitlesResponse = z.infer<typeof netflixSubtitlesResponseSchema>

async function requestNetflixSubtitles(
  action: NetflixSubtitlesAction,
): Promise<NetflixSubtitlesResponse | null> {
  const response = await postMessageRequest(
    NETFLIX_SUBTITLES_RESPONSE_TYPE,
    { type: NETFLIX_SUBTITLES_REQUEST_TYPE, action },
    action === "load" ? NETFLIX_LOAD_POST_MESSAGE_TIMEOUT_MS : POST_MESSAGE_TIMEOUT_MS,
  )
  const parsed = netflixSubtitlesResponseSchema.safeParse(response)
  return parsed.success ? parsed.data : null
}

export class NetflixSubtitlesFetcher implements SubtitlesFetcher {
  private subtitles: SubtitlesFragment[] = []
  private sourceLanguage = ""
  private movieId: number | null = null
  private trackId: string | null = null

  async fetch(): Promise<SubtitlesFragment[]> {
    const response = await requestNetflixSubtitles("load")
    // No reply, or a player that never became ready: either way the wait ran out.
    if (!response || response.movieId === null) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.fetchSubTimeout"))
    }
    if (
      this.subtitles.length > 0 &&
      response.movieId === this.movieId &&
      response.trackId === this.trackId
    ) {
      return this.subtitles
    }
    if (!response.translatable) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }
    // The video has a usable track, but its subtitle file never reached the page script.
    if (!response.ttml) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.trackFileNotLoaded"))
    }

    const parsed = parseNetflixTtml(response.ttml)
    if (!parsed.fragments.length) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }

    this.subtitles = parsed.fragments
    this.sourceLanguage = parsed.language
    this.movieId = response.movieId
    this.trackId = response.trackId
    return this.subtitles
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  isPreSegmented(): boolean {
    return true
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    return true
  }

  async shouldUseSameTrack(): Promise<boolean> {
    if (this.subtitles.length === 0) {
      return false
    }
    const response = await requestNetflixSubtitles("state")
    if (!response) {
      return true
    }
    if (response.movieId !== this.movieId) {
      return false
    }
    return !response.translatable || response.trackId === this.trackId
  }

  showNativeSubtitles(): void {
    void requestNetflixSubtitles("restore")
  }

  cleanup(): void {
    this.subtitles = []
    this.sourceLanguage = ""
    this.movieId = null
    this.trackId = null
  }
}
