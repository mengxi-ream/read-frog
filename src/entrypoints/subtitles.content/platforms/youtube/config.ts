import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  DEFAULT_CONTROLS_HEIGHT,
  YOUTUBE_NATIVE_SUBTITLES_CLASS,
  YOUTUBE_NAVIGATE_FINISH_EVENT,
  YOUTUBE_NAVIGATE_START_EVENT,
} from "@/utils/constants/subtitles"
import { getYoutubeVideoId } from "@/utils/subtitles/video-id"

interface YoutubeConfigOptions {
  embedded?: boolean
}

export function getYoutubeConfig(options: YoutubeConfigOptions = {}): PlatformConfig {
  const { embedded } = options

  return {
    embedded,

    selectors: {
      video: "video.html5-main-video",
      playerContainer: "#movie_player.html5-video-player",
      controlsBar: embedded ? ".quick-actions-wrapper" : "#movie_player .ytp-right-controls",
      nativeSubtitles: YOUTUBE_NATIVE_SUBTITLES_CLASS,
    },

    events: embedded
      ? {}
      : {
          navigateStart: YOUTUBE_NAVIGATE_START_EVENT,
          navigateFinish: YOUTUBE_NAVIGATE_FINISH_EVENT,
        },

    controls: embedded
      ? {
          findVideoContainer: () => document.querySelector<HTMLElement>("#movie_player"),
          measureHeight: () => {
            const wrapper = document.querySelector(".quick-actions-wrapper")
            const player = document.querySelector("#movie_player")
            const progressBar = player?.querySelector(".ytp-progress-bar-container")
            if (!wrapper || !progressBar)
              return DEFAULT_CONTROLS_HEIGHT
            return wrapper.getBoundingClientRect().top - progressBar.getBoundingClientRect().top
          },
          checkVisibility: () => true,
        }
      : {
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
}
