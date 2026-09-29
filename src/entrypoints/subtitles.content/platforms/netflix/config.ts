import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  DEFAULT_CONTROLS_HEIGHT,
  NETFLIX_CONTROLS_SELECTOR,
  NETFLIX_NATIVE_SUBTITLES_SELECTOR,
  NETFLIX_PLAYER_SELECTOR,
} from "@/utils/constants/subtitles"
import { getNetflixMovieId } from "@/utils/subtitles/video-id"

export function getNetflixConfig(): PlatformConfig {
  return {
    selectors: {
      video: `${NETFLIX_PLAYER_SELECTOR} video`,
      playerContainer: NETFLIX_PLAYER_SELECTOR,
      nativeSubtitles: NETFLIX_NATIVE_SUBTITLES_SELECTOR,
    },
    events: {},
    controls: {
      measureHeight: (container) =>
        container.querySelector(NETFLIX_CONTROLS_SELECTOR)?.getBoundingClientRect().height ??
        DEFAULT_CONTROLS_HEIGHT,
      checkVisibility: (container) => !!container.querySelector(NETFLIX_CONTROLS_SELECTOR),
    },
    getVideoId: getNetflixMovieId,
  }
}
