import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  DEFAULT_CONTROLS_HEIGHT,
  EDX_CONTROLS_BAR_SELECTOR,
  EDX_CONTROLS_SELECTOR,
  EDX_NATIVE_SUBTITLES_SELECTOR,
  EDX_PLAYER_SELECTOR,
} from "@/utils/constants/subtitles"
import { getEdxVideoId } from "@/utils/subtitles/video-id"

export function getEdxConfig(): PlatformConfig {
  return {
    platform: "edx",
    selectors: {
      video: `${EDX_PLAYER_SELECTOR} video`,
      playerContainer: EDX_PLAYER_SELECTOR,
      controlsBar: EDX_CONTROLS_BAR_SELECTOR,
      nativeSubtitles: EDX_NATIVE_SUBTITLES_SELECTOR,
    },
    events: {},
    controls: {
      measureHeight: (container) =>
        container.querySelector(EDX_CONTROLS_SELECTOR)?.getBoundingClientRect().height ??
        DEFAULT_CONTROLS_HEIGHT,
      checkVisibility: (container) =>
        !container.querySelector(`${EDX_CONTROLS_SELECTOR}.is-hidden`),
      // The controls show and hide by a class; the time display rewrites the subtree every second.
      observe: { attributes: true, attributeFilter: ["class"], subtree: true },
    },
    getVideoId: getEdxVideoId,
  }
}
