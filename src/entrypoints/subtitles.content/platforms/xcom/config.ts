import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import type { AiSubtitlesContext } from "@/utils/subtitles/ai/request-ai-subtitles"
import {
  DEFAULT_CONTROLS_HEIGHT,
  XCOM_PLAYER_CONTAINER_SELECTOR,
} from "@/utils/constants/subtitles"
import { getCurrentXcomSubtitlesVideo, getCurrentXcomVideoId } from "./dom"

function createXcomAiSubtitlesContext(): AiSubtitlesContext | null {
  const videoId = getCurrentXcomVideoId()
  const duration = getCurrentXcomSubtitlesVideo()?.duration
  if (!videoId || !duration || !Number.isFinite(duration)) {
    return null
  }
  return { videoId, url: `https://x.com/i/status/${videoId}`, durationSec: Math.ceil(duration) }
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
