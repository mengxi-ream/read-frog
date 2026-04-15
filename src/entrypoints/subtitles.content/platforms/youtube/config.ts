import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  DEFAULT_CONTROLS_HEIGHT,
  YOUTUBE_NATIVE_SUBTITLES_CLASS,
  YOUTUBE_NAVIGATE_FINISH_EVENT,
  YOUTUBE_NAVIGATE_START_EVENT,
} from "@/utils/constants/subtitles"
import { getYoutubeVideoId } from "@/utils/subtitles/video-id"

export const youtubeConfig: PlatformConfig = {
  selectors: {
    video: "video.html5-main-video",
    playerContainer: "#movie_player.html5-video-player",
    controlsBar: "#movie_player .ytp-right-controls",
    nativeSubtitles: YOUTUBE_NATIVE_SUBTITLES_CLASS,
  },

  events: {
    navigateStart: YOUTUBE_NAVIGATE_START_EVENT,
    navigateFinish: YOUTUBE_NAVIGATE_FINISH_EVENT,
  },

  controls: {
    measureHeight: (container) => {
      const player = container.closest(".html5-video-player")
      const progressBar = player?.querySelector(".ytp-progress-bar-container")
      const controlsBar = progressBar?.parentElement
      return controlsBar?.getBoundingClientRect().height ?? DEFAULT_CONTROLS_HEIGHT
    },
    checkVisibility: (container) => {
      const player = container.closest(".html5-video-player")
      return !!player && !player.classList.contains("ytp-autohide")
    },
  },

  getVideoId: getYoutubeVideoId,
}
