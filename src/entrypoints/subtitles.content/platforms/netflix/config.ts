import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { STREAMING_NATIVE_SUBTITLES_SELECTOR } from "@/utils/constants/subtitles"

const URL_CHANGE_EVENT = "extension:URLChange"

export function getNetflixConfig(): PlatformConfig {
  return {
    selectors: {
      video: "video",
      playerContainer: "body",
      nativeSubtitles: STREAMING_NATIVE_SUBTITLES_SELECTOR,
    },
    events: {
      navigateStart: URL_CHANGE_EVENT,
      navigateFinish: URL_CHANGE_EVENT,
    },
    controls: {
      findVideoContainer: () => document.querySelector<HTMLElement>("video")?.parentElement ?? document.body,
      measureHeight: () => 0,
      checkVisibility: () => true,
    },
    // Only /watch/<id> pages carry a video id; browse/details pages return null so
    // they don't trigger a navigation reset that would drop the next title's session.
    getVideoId: () => window.location.pathname.match(/^\/watch\/([^/?#]+)/)?.[1] ?? null,
  }
}
