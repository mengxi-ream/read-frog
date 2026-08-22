import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  DEFAULT_CONTROLS_HEIGHT,
  YOUTUBE_NATIVE_SUBTITLES_CLASS,
  YOUTUBE_NAVIGATE_FINISH_EVENT,
  YOUTUBE_NAVIGATE_START_EVENT,
} from "@/utils/constants/subtitles"
import { requestPlayerData } from "@/utils/subtitles/fetchers/youtube"
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
const WATCH_PLAYER = "#movie_player.html5-video-player"

function createYoutubeAiSubtitlesContext() {
  const videoId = getYoutubeVideoId()
  if (!videoId) {
    return null
  }
  // The player's own duration, sent as `durationSec` with the create request.
  // An untrusted admission hint only — the server measures the real duration
  // in its worker before billing — so the ad-playback edge (where `duration`
  // briefly reports the ad's length) is harmless. NaN until metadata loads,
  // which cannot happen behind an open settings panel.
  const video = document.querySelector<HTMLVideoElement>("video.html5-main-video")
  const duration = video?.duration
  if (!duration || !Number.isFinite(duration) || duration <= 0) {
    return null
  }
  return { videoId, url: location.href, durationSec: Math.ceil(duration) }
}

async function isYoutubeLiveContent(): Promise<boolean> {
  const videoId = getYoutubeVideoId()
  if (!videoId) {
    return false
  }
  const response = await requestPlayerData(videoId)
  return response.data?.isLiveContent ?? false
}

/** YouTube marks mid-rolls / pre-rolls on the html5 player with these classes. */
function isYoutubeAdPlaying(playerContainer: HTMLElement): boolean {
  return (
    playerContainer.classList.contains("ad-showing") ||
    playerContainer.classList.contains("ad-interrupting")
  )
}

const YOUTUBE_MODE_CONFIGS: Record<YoutubeMode, PlatformConfig> = {
  watch: {
    embedded: false,
    selectors: {
      video: "video.html5-main-video",
      playerContainer: WATCH_PLAYER,
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
    supportsSidebar: true,
    getVideoId: getYoutubeVideoId,
    createAiSubtitlesContext: createYoutubeAiSubtitlesContext,
    isAdPlaying: isYoutubeAdPlaying,
    isLiveContent: isYoutubeLiveContent,
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
        if (!wrapper || !progressBar) return DEFAULT_CONTROLS_HEIGHT
        return wrapper.getBoundingClientRect().top - progressBar.getBoundingClientRect().top
      },
      checkVisibility: () => true,
    },
    getVideoId: getYoutubeVideoId,
    createAiSubtitlesContext: createYoutubeAiSubtitlesContext,
    isAdPlaying: isYoutubeAdPlaying,
    isLiveContent: isYoutubeLiveContent,
  },

  shorts: {
    embedded: true,
    silentErrors: true,
    containerShrinkRatio: (container) => {
      const ratio = Number.parseFloat(
        getComputedStyle(container).getPropertyValue("--ytd-shorts-player-ratio"),
      )
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
    createAiSubtitlesContext: createYoutubeAiSubtitlesContext,
    isAdPlaying: isYoutubeAdPlaying,
    isLiveContent: isYoutubeLiveContent,
  },
}

export function getYoutubeConfig({ mode = "watch" }: YoutubeConfigOptions = {}): PlatformConfig {
  return YOUTUBE_MODE_CONFIGS[mode]
}
