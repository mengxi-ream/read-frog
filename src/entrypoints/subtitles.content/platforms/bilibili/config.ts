import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  BILIBILI_CONTROL_BUTTON_HEIGHT,
  BILIBILI_CONTROLS_BAR_SELECTOR,
  BILIBILI_CONTROLS_SELECTOR,
  BILIBILI_NATIVE_SUBTITLES_SELECTOR,
  BILIBILI_PLAYER_SELECTOR,
  BILIBILI_VIDEO_AREA_SELECTOR,
  DEFAULT_CONTROLS_HEIGHT,
} from "@/utils/constants/subtitles"
import { getBilibiliPartId } from "@/utils/subtitles/video-id"

export function getBilibiliConfig(): PlatformConfig {
  return {
    platform: "bilibili",
    selectors: {
      video: `${BILIBILI_VIDEO_AREA_SELECTOR} video`,
      playerContainer: BILIBILI_VIDEO_AREA_SELECTOR,
      controlsBar: BILIBILI_CONTROLS_BAR_SELECTOR,
      nativeSubtitles: BILIBILI_NATIVE_SUBTITLES_SELECTOR,
    },
    events: {},
    controls: {
      // The player container, not the video area, says whether the controls are hidden.
      findVideoContainer: () => document.querySelector<HTMLElement>(BILIBILI_PLAYER_SELECTOR),
      measureHeight: (container) =>
        container.querySelector(BILIBILI_CONTROLS_SELECTOR)?.getBoundingClientRect().height ??
        DEFAULT_CONTROLS_HEIGHT,
      checkVisibility: (container) => container.dataset.ctrlHidden !== "true",
      observe: { attributes: true, attributeFilter: ["data-ctrl-hidden"] },
    },
    translateButtonHeight: BILIBILI_CONTROL_BUTTON_HEIGHT,
    getVideoId: getBilibiliPartId,
  }
}
