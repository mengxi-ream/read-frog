import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import type { AiSubtitlesContext } from "@/utils/subtitles/ai/request-ai-subtitles"
import { xcomMediaIdFromUrl } from "@read-frog/definitions"
import {
  DEFAULT_CONTROLS_HEIGHT,
  XCOM_PLAYER_CONTAINER_SELECTOR,
} from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { resolveAiSubtitlesContext } from "@/utils/subtitles/ai/ai-subtitles-context"
import {
  getCurrentXcomSubtitlesVideo,
  getCurrentXcomVideoId,
  getCurrentXcomVideoUrl,
  getXcomVideoPostUrl,
} from "./dom"

// X plays a GIF as a silent looping video, with its poster under this path.
const XCOM_GIF_POSTER_PATTERN = /^https:\/\/pbs\.twimg\.com\/tweet_video_thumb\//
// X's player gives a broadcast still live a finite duration that grows, so its poster marks it.
const XCOM_LIVE_POSTER_PATTERN =
  /^https:\/\/[^/]+\.video\.pscp\.tv\/Transcoding\/v1\/live_thumbnail\//

function isXcomLiveVideo(video: Pick<HTMLVideoElement, "duration" | "poster">): boolean {
  return video.duration === Number.POSITIVE_INFINITY || XCOM_LIVE_POSTER_PATTERN.test(video.poster)
}

// A poster without a media id, as a custom cover's or a replay's, keys the post's only video.
function createXcomAiSubtitlesContext(): AiSubtitlesContext | null {
  const video = getCurrentXcomSubtitlesVideo()
  if (!video || XCOM_GIF_POSTER_PATTERN.test(video.poster) || isXcomLiveVideo(video)) {
    return null
  }
  const url = getXcomVideoPostUrl(video)
  return url
    ? resolveAiSubtitlesContext({
        url,
        mediaId: xcomMediaIdFromUrl(video.poster) ?? undefined,
        video,
      })
    : null
}

async function isXcomLiveContent(): Promise<boolean> {
  const video = getCurrentXcomSubtitlesVideo()
  return !!video && isXcomLiveVideo(video)
}

export function getXcomConfig(): PlatformConfig {
  return {
    platform: "xcom",
    embedded: true,
    selectors: {
      video: `${XCOM_PLAYER_CONTAINER_SELECTOR} video`,
      playerContainer: XCOM_PLAYER_CONTAINER_SELECTOR,
    },
    events: {},
    controls: {
      findVideoContainer: () => document.querySelector<HTMLElement>(XCOM_PLAYER_CONTAINER_SELECTOR),
      measureHeight: () => DEFAULT_CONTROLS_HEIGHT,
      checkVisibility: (container) => {
        const player = container.closest("[data-testid='videoComponent']") ?? container
        return player.matches(":hover, :focus-within") || !!container.querySelector("video")?.paused
      },
    },
    getVideoId: getCurrentXcomVideoId,
    getVideoPageUrl: getCurrentXcomVideoUrl,
    createAiSubtitlesContext: createXcomAiSubtitlesContext,
    isLiveContent: isXcomLiveContent,
    // A replay gets AI subtitles, so only a broadcast still live is refused.
    liveContentMessage: () => i18n.t("subtitles.errors.aiLiveStreamUnsupported"),
  }
}
