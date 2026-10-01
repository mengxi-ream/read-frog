import type { SubtitlesFetcher } from "../types"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { z } from "zod"
import {
  NETFLIX_SUBTITLES_REQUEST_TYPE,
  NETFLIX_SUBTITLES_RESPONSE_TYPE,
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
  const response = await postMessageRequest(NETFLIX_SUBTITLES_RESPONSE_TYPE, {
    type: NETFLIX_SUBTITLES_REQUEST_TYPE,
    action,
  })
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
    if (!response) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.fetchSubTimeout"))
    }
    if (
      this.subtitles.length > 0 &&
      response.movieId === this.movieId &&
      response.trackId === this.trackId
    ) {
      return this.subtitles
    }

    const parsed = response.translatable && response.ttml ? parseNetflixTtml(response.ttml) : null
    if (!parsed?.fragments.length) {
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
