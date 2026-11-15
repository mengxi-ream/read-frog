import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import type { AiSubtitlesContext } from "@/utils/subtitles/ai/request-ai-subtitles"
import { xcomMediaIdFromUrl } from "@read-frog/definitions"
import {
  DEFAULT_CONTROLS_HEIGHT,
  XCOM_PLAYER_CONTAINER_SELECTOR,
} from "@/utils/constants/subtitles"
import { getCurrentXcomSubtitlesVideo, getCurrentXcomVideoId } from "./dom"

// The poster's media id tells the playing video apart from the post's others.
function createXcomAiSubtitlesContext(): AiSubtitlesContext | null {
  const statusId = getCurrentXcomVideoId()
  const video = getCurrentXcomSubtitlesVideo()
  const mediaId = video ? xcomMediaIdFromUrl(video.poster) : null
  const duration = video?.duration
  if (!statusId || !mediaId || !duration || !Number.isFinite(duration)) {
    return null
  }
  return {
    videoId: mediaId,
    url: `https://x.com/i/status/${statusId}`,
    durationSec: Math.ceil(duration),
    mediaId,
  }
}

async function isXcomLiveContent(): Promise<boolean> {
  return getCurrentXcomSubtitlesVideo()?.duration === Number.POSITIVE_INFINITY
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
    createAiSubtitlesContext: createXcomAiSubtitlesContext,
    isLiveContent: isXcomLiveContent,
  }
}
