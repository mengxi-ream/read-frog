import { getVideoIdFromUrl } from "@read-frog/definitions"

/**
 * Delegates to the same extractor the server uses to validate
 * `videoTranscript.create({ url })`, so the extension can never consider a
 * video subtitle-capable that the server would reject (or vice versa).
 */
export function getYoutubeVideoId(): string | null {
  return getVideoIdFromUrl(window.location.href)
}
