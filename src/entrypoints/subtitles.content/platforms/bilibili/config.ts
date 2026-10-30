import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  BILIBILI_CONTROLS_BAR_SELECTOR,
  BILIBILI_CONTROLS_SELECTOR,
  BILIBILI_NATIVE_SUBTITLES_SELECTOR,
  BILIBILI_PLAYER_SELECTOR,
  DEFAULT_CONTROLS_HEIGHT,
} from "@/utils/constants/subtitles"
import { getBilibiliPartId } from "@/utils/subtitles/video-id"

export function getBilibiliConfig(): PlatformConfig {
  return {
    platform: "bilibili",
    selectors: {
      video: `${BILIBILI_PLAYER_SELECTOR} video`,
      playerContainer: BILIBILI_PLAYER_SELECTOR,
      controlsBar: BILIBILI_CONTROLS_BAR_SELECTOR,
      nativeSubtitles: BILIBILI_NATIVE_SUBTITLES_SELECTOR,
    },
    events: {},
    controls: {
      measureHeight: (container) =>
        container.querySelector(BILIBILI_CONTROLS_SELECTOR)?.getBoundingClientRect().height ??
        DEFAULT_CONTROLS_HEIGHT,
      checkVisibility: (container) => container.dataset.ctrlHidden !== "true",
      observe: { attributes: true, attributeFilter: ["data-ctrl-hidden"] },
    },
    getVideoId: getBilibiliPartId,
  }
}
