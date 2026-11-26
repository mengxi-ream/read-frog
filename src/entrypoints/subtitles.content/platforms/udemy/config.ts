import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  DEFAULT_CONTROLS_HEIGHT,
  UDEMY_CONTROL_BAR_SELECTOR,
  UDEMY_INACTIVE_CONTROLS_SELECTOR,
  UDEMY_NATIVE_SUBTITLES_SELECTOR,
  UDEMY_PLAYER_SELECTOR,
} from "@/utils/constants/subtitles"
import { getUdemyLectureId } from "@/utils/subtitles/video-id"

export function getUdemyConfig(): PlatformConfig {
  return {
    platform: "udemy",
    selectors: {
      video: `${UDEMY_PLAYER_SELECTOR} video`,
      playerContainer: UDEMY_PLAYER_SELECTOR,
      nativeSubtitles: UDEMY_NATIVE_SUBTITLES_SELECTOR,
    },
    events: {},
    controls: {
      measureHeight: (container) =>
        container.querySelector(UDEMY_CONTROL_BAR_SELECTOR)?.getBoundingClientRect().height ??
        DEFAULT_CONTROLS_HEIGHT,
      checkVisibility: (container) => !container.querySelector(UDEMY_INACTIVE_CONTROLS_SELECTOR),
      // The controls hide by a class; the time display rewrites the subtree every second.
      observe: { attributes: true, attributeFilter: ["class"], subtree: true },
    },
    getVideoId: getUdemyLectureId,
  }
}
