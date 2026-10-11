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
  // What the latest load found, even one that ended without subtitles.
  private lastLoad: { movieId: number | null; trackId: string | null } | null = null
  private loadsInFlight = 0

  async fetch(): Promise<SubtitlesFragment[]> {
    let response: NetflixSubtitlesResponse | null
    this.loadsInFlight++
    try {
      response = await requestNetflixSubtitles("load")
    } finally {
      this.loadsInFlight--
    }

    const found = { movieId: response?.movieId ?? null, trackId: response?.trackId ?? null }
    if (
      this.subtitles.length > 0 &&
      found.movieId === this.lastLoad?.movieId &&
      found.trackId === this.lastLoad.trackId
    ) {
      return this.subtitles
    }
    // Recorded before the checks below, so the track poll also compares with a load that failed.
    this.lastLoad = found
    this.subtitles = []
    this.sourceLanguage = ""

    // No reply, or a player that never became ready: either way the wait ran out.
    if (!response || response.movieId === null) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.fetchSubTimeout"))
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

  // Netflix's track poll asks this every second, so only a change on the page should start a load.
  async shouldUseSameTrack(): Promise<boolean> {
    // Starting another load now would only throw away the one still running.
    if (this.loadsInFlight > 0) {
      return true
    }
    const lastLoad = this.lastLoad
    if (!lastLoad) {
      return false
    }
    const response = await requestNetflixSubtitles("state")
    if (!response) {
      return true
    }
    // A failed load counts too: the same failure is not retried every second, but a new episode,
    // a new track, or a player that is finally ready still reloads.
    if (response.movieId !== lastLoad.movieId) {
      return false
    }
    return !response.translatable || response.trackId === lastLoad.trackId
  }

  showNativeSubtitles(): void {
    void requestNetflixSubtitles("restore")
  }

  cleanup(): void {
    this.subtitles = []
    this.sourceLanguage = ""
    this.lastLoad = null
  }
}
