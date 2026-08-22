import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import {
  DEFAULT_CONTROLS_HEIGHT,
  XCOM_CONTROLS_CONTAINER_SELECTOR,
  XCOM_PLAYER_CONTAINER_SELECTOR,
} from "@/utils/constants/subtitles"
import { getXcomStatusId } from "@/utils/subtitles/video-id"

/**
 * x.com has no stable player container or controls bar, so the overlay entry
 * point stamps its own attributes onto the tweet's video container and injects
 * a placeholder controls element. Every selector below targets those stamps
 * rather than x.com's own markup.
 *
 * `nativeSubtitles` intentionally matches nothing: x.com renders captions
 * through browser TextTracks, which CSS cannot hide. `XcomSubtitlesFetcher`
 * disables those tracks instead.
 */
export function getXcomConfig(): PlatformConfig {
  return {
    embedded: true,
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
