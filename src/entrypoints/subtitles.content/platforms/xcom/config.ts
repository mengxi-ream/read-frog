import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  DEFAULT_CONTROLS_HEIGHT,
  XCOM_CONTROLS_CONTAINER_SELECTOR,
  XCOM_PLAYER_CONTAINER_SELECTOR,
} from "@/utils/constants/subtitles"
import { getXcomStatusId } from "@/utils/subtitles/video-id"

export function getXcomConfig(): PlatformConfig {
  return {
    embedded: true,
    subtitlesPanelPlacement: "left",
    selectors: {
      video: `${XCOM_PLAYER_CONTAINER_SELECTOR} video`,
      playerContainer: XCOM_PLAYER_CONTAINER_SELECTOR,
      controlsBar: XCOM_CONTROLS_CONTAINER_SELECTOR,
      nativeSubtitles: "[data-read-frog-xcom-native-subtitles]",
    },
    events: {},
    controls: {
      findVideoContainer: () => document.querySelector<HTMLElement>(XCOM_PLAYER_CONTAINER_SELECTOR),
      measureHeight: () => DEFAULT_CONTROLS_HEIGHT,
      checkVisibility: () => true,
    },
    getVideoId: getXcomStatusId,
  }
}
