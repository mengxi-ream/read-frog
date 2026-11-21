import type { AiSubtitlesContext } from "./request-ai-subtitles"
import { resolveTranscriptVideo } from "@read-frog/definitions"

/** Keys the playing video as the server does and claims the player's length; null before its
 * metadata loads, for a live stream, or for a malformed media id. */
export function resolveAiSubtitlesContext({
  url,
  mediaId,
  video,
}: {
  url: string
  mediaId?: string
  video: Pick<HTMLVideoElement, "duration"> | null
}): AiSubtitlesContext | null {
  const videoId = resolveTranscriptVideo({ url, mediaId })?.videoId
  const duration = video?.duration ?? 0
  if (!videoId || !Number.isFinite(duration) || duration <= 0) {
    return null
  }
  return { videoId, url, durationSec: Math.ceil(duration), mediaId }
}
