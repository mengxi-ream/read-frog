import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  DEFAULT_CONTROLS_HEIGHT,
  PRIME_VIDEO_PLAYER_SELECTOR,
  PRIME_VIDEO_NATIVE_SUBTITLES_SELECTOR,
  PRIME_VIDEO_PROGRESS_HANDLE_SELECTOR,
  PRIME_VIDEO_VIDEO_SELECTOR,
} from "@/utils/constants/subtitles"
import { getPrimeVideoTitleId } from "@/utils/subtitles/video-id"

export function getPrimeVideoConfig(): PlatformConfig {
  return {
    platform: "primevideo",
    selectors: {
      video: PRIME_VIDEO_VIDEO_SELECTOR,
      playerContainer: PRIME_VIDEO_PLAYER_SELECTOR,
      nativeSubtitles: PRIME_VIDEO_NATIVE_SUBTITLES_SELECTOR,
    },
    events: {},
    controls: {
      // The bottom controls reach from the progress bar down.
      measureHeight: (container) => {
        const handle = container.querySelector(PRIME_VIDEO_PROGRESS_HANDLE_SELECTOR)
        return handle
          ? container.getBoundingClientRect().bottom - handle.getBoundingClientRect().top
          : DEFAULT_CONTROLS_HEIGHT
      },
      checkVisibility: (container) =>
        !!container.querySelector(PRIME_VIDEO_PROGRESS_HANDLE_SELECTOR),
    },
    getVideoId: getPrimeVideoTitleId,
  }
}
