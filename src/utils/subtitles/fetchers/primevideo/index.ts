import type { SubtitlesTrack, SubtitlesTrackSource } from "../track"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { isSameLanguage } from "@read-frog/definitions"
import { z } from "zod"
import {
  PRIME_VIDEO_SUBTITLES_REQUEST_TYPE,
  PRIME_VIDEO_SUBTITLES_RESPONSE_TYPE,
} from "@/utils/constants/subtitles"
import { resolveLanguageCodeFromLocale } from "@/utils/content/page-language"
import { i18n } from "@/utils/i18n"
import {
  NoSubtitlesError,
  OverlaySubtitlesError,
  TrackFileNotLoadedError,
} from "@/utils/subtitles/errors"
import { getPrimeVideoTitleId } from "@/utils/subtitles/video-id"
import { fetchWithRetry, readText } from "../fetch-with-retry"
import { postMessageRequest } from "../post-message-request"
import { parseTtml } from "../ttml"

const primeVideoSubtitlesResponseSchema = z.object({
  type: z.string(),
  requestId: z.string(),
  resources: z.object({ timedText: z.unknown(), playlist: z.unknown() }).nullable(),
})

export type PrimeVideoSubtitlesResponse = z.infer<typeof primeVideoSubtitlesResponseSchema>

const timedTextSchema = z.object({ subtitleUrls: z.array(z.unknown()) })

const subtitleEntrySchema = z.object({
  languageCode: z.string(),
  type: z.string(),
  url: z.string().nonempty(),
})

type SubtitleEntry = z.infer<typeof subtitleEntrySchema>

const playlistSchema = z.array(
  z.object({
    type: z.string(),
    startMs: z.number().optional(),
    endMs: z.number().optional(),
    defaultAudioTrackId: z.string().optional(),
  }),
)

type Playlist = z.infer<typeof playlistSchema>

// In order of preference: the dialogue alone, then the version that also describes sounds.
const SUBTITLE_TYPES = ["Subtitle", "Sdh"]

async function requestPrimeVideoSubtitles(
  titleId: string,
): Promise<PrimeVideoSubtitlesResponse | null> {
  const response = await postMessageRequest(PRIME_VIDEO_SUBTITLES_RESPONSE_TYPE, {
    type: PRIME_VIDEO_SUBTITLES_REQUEST_TYPE,
    titleId,
  })
  const parsed = primeVideoSubtitlesResponseSchema.safeParse(response)
  return parsed.success ? parsed.data : null
}

function parseEntries(subtitleUrls: unknown[]): SubtitleEntry[] {
  return subtitleUrls
    .flatMap((entry) => {
      const parsed = subtitleEntrySchema.safeParse(entry)
      return parsed.success && SUBTITLE_TYPES.includes(parsed.data.type) ? [parsed.data] : []
    })
    .sort((a, b) => SUBTITLE_TYPES.indexOf(a.type) - SUBTITLE_TYPES.indexOf(b.type))
}

function findInLanguage(entries: SubtitleEntry[], locale: string): SubtitleEntry | undefined {
  const language = resolveLanguageCodeFromLocale(locale)
  if (!language) return undefined
  return (
    entries.find((entry) => entry.languageCode === locale) ??
    entries.find((entry) => {
      const entryLanguage = resolveLanguageCodeFromLocale(entry.languageCode)
      return !!entryLanguage && isSameLanguage(entryLanguage, language)
    })
  )
}

/** The subtitles in the language spoken, as Netflix picks them: then English, then any. */
function pickSubtitle(entries: SubtitleEntry[], playlist: Playlist): SubtitleEntry | null {
  // An audio track id reads like `en-us_dialog_0`.
  const audioLanguage = playlist
    .find((item) => item.defaultAudioTrackId)
    ?.defaultAudioTrackId?.split("_")[0]
  return (
    (audioLanguage && findInLanguage(entries, audioLanguage)) ||
    findInLanguage(entries, "en") ||
    entries[0] ||
    null
  )
}

/**
 * The video plays the title's timed items one after another, a lead-in card before the feature, so
 * a time in the feature sits later on it. An ad slot comes untimed and takes no room here.
 */
function toVideoTime(fragments: SubtitlesFragment[], playlist: Playlist): SubtitlesFragment[] {
  let position = 0
  const features: Array<{ end: number; shift: number }> = []
  for (const { type, startMs, endMs } of playlist) {
    if (startMs === undefined || endMs === undefined) continue
    if (type === "Main") features.push({ end: endMs, shift: position - startMs })
    position += endMs - startMs
  }

  return fragments.map((fragment) => {
    const shift = (features.find(({ end }) => fragment.start < end) ?? features.at(-1))?.shift ?? 0
    return { ...fragment, start: fragment.start + shift, end: fragment.end + shift }
  })
}

async function loadTrack(titleId: string): Promise<SubtitlesTrack> {
  const response = await requestPrimeVideoSubtitles(titleId)
  if (!response) {
    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.fetchSubTimeout"))
  }
  const timedText = timedTextSchema.safeParse(response.resources?.timedText)
  if (!timedText.success) throw new TrackFileNotLoadedError()

  const playlist = playlistSchema.safeParse(response.resources?.playlist).data ?? []
  const subtitle = pickSubtitle(parseEntries(timedText.data.subtitleUrls), playlist)
  if (!subtitle) throw new NoSubtitlesError()

  const xml = await readText(await fetchWithRetry(subtitle.url))
  if (xml === null) throw new TrackFileNotLoadedError()

  const { language, fragments } = parseTtml(xml)
  return {
    language: language || subtitle.languageCode,
    fragments: toVideoTime(fragments, playlist),
  }
}

export const primeVideoTrackSource: SubtitlesTrackSource = {
  currentKey: getPrimeVideoTitleId,
  load: loadTrack,
  preSegmented: true,
}
