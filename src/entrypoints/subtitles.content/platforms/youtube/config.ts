import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  DEFAULT_CONTROLS_HEIGHT,
  YOUTUBE_NATIVE_SUBTITLES_CLASS,
  YOUTUBE_NAVIGATE_FINISH_EVENT,
  YOUTUBE_NAVIGATE_START_EVENT,
} from "@/utils/constants/subtitles"
import { getYoutubeVideoId } from "@/utils/subtitles/video-id"

type YoutubeMode = "watch" | "embed" | "shorts"

interface YoutubeConfigOptions {
  mode?: YoutubeMode
}

const NAVIGATE_EVENTS = {
  navigateStart: YOUTUBE_NAVIGATE_START_EVENT,
  navigateFinish: YOUTUBE_NAVIGATE_FINISH_EVENT,
}

const SHORTS_ACTIVE_PLAYER = "#reel-overlay-container .html5-video-player"

const YOUTUBE_MODE_CONFIGS: Record<YoutubeMode, PlatformConfig> = {
  watch: {
    embedded: false,
    selectors: {
      video: "video.html5-main-video",
      playerContainer: "#movie_player.html5-video-player",
      controlsBar: "#movie_player .ytp-right-controls",
      nativeSubtitles: YOUTUBE_NATIVE_SUBTITLES_CLASS,
    },
    events: NAVIGATE_EVENTS,
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
  },

  embed: {
    embedded: true,
    selectors: {
      video: "video.html5-main-video",
      playerContainer: "#movie_player.html5-video-player",
      controlsBar: ".quick-actions-wrapper",
      nativeSubtitles: YOUTUBE_NATIVE_SUBTITLES_CLASS,
    },
    events: {},
    controls: {
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
    },
    getVideoId: getYoutubeVideoId,
  },

  shorts: {
    embedded: true,
    silentErrors: true,
    containerShrinkRatio: (container) => {
      const ratio = Number.parseFloat(getComputedStyle(container).getPropertyValue("--ytd-shorts-player-ratio"))
      return Number.isFinite(ratio) && ratio > 0 ? ratio : null
    },
    selectors: {
      video: "video.html5-main-video",
      playerContainer: SHORTS_ACTIVE_PLAYER,
      nativeSubtitles: YOUTUBE_NATIVE_SUBTITLES_CLASS,
    },
    events: {},
    controls: {
      findVideoContainer: () => document.querySelector<HTMLElement>(SHORTS_ACTIVE_PLAYER),
      measureHeight: () => DEFAULT_CONTROLS_HEIGHT,
      checkVisibility: () => true,
    },
    getVideoId: getYoutubeVideoId,
  },
}

export function getYoutubeConfig({ mode = "watch" }: YoutubeConfigOptions = {}): PlatformConfig {
  return YOUTUBE_MODE_CONFIGS[mode]
}
