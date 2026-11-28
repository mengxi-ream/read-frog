import type { PrimeVideoSubtitlesResponse } from "@/utils/subtitles/fetchers/primevideo"
import {
  PRIME_VIDEO_SUBTITLES_REQUEST_TYPE,
  PRIME_VIDEO_SUBTITLES_RESPONSE_TYPE,
  PRIME_VIDEO_TITLE_ID_ATTRIBUTE,
  PRIME_VIDEO_VIDEO_SELECTOR,
} from "@/utils/constants/subtitles"
import { findPlaybackResources, findTitleIdByDuration } from "./playback-resources"

function markPlayingTitle(video: HTMLVideoElement): void {
  // An emptied video's NaN length matches no title.
  const titleId = findTitleIdByDuration(video.duration * 1000)
  if (titleId) {
    video.setAttribute(PRIME_VIDEO_TITLE_ID_ATTRIBUTE, titleId)
  } else {
    video.removeAttribute(PRIME_VIDEO_TITLE_ID_ATTRIBUTE)
  }
}

/** For resources that arrive after the video they belong to has its length. */
export function markUnmarkedVideo(): void {
  const video = document.querySelector<HTMLVideoElement>(PRIME_VIDEO_VIDEO_SELECTOR)
  if (video && !video.hasAttribute(PRIME_VIDEO_TITLE_ID_ATTRIBUTE)) markPlayingTitle(video)
}

/** Prime reuses one video for every title, so each new length or emptied source marks it again. */
export function watchPlayingTitle(): void {
  const mark = (event: Event) => {
    if (
      event.target instanceof HTMLVideoElement &&
      event.target.matches(PRIME_VIDEO_VIDEO_SELECTOR)
    ) {
      markPlayingTitle(event.target)
    }
  }
  // Media events do not bubble, so they are caught on their way down.
  document.addEventListener("durationchange", mark, true)
  document.addEventListener("emptied", mark, true)
}

export function listenForSubtitlesRequests(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (
      event.origin !== window.location.origin ||
      event.data?.type !== PRIME_VIDEO_SUBTITLES_REQUEST_TYPE
    ) {
      return
    }
    const { requestId, titleId } = event.data
    const response: PrimeVideoSubtitlesResponse = {
      type: PRIME_VIDEO_SUBTITLES_RESPONSE_TYPE,
      requestId,
      resources: typeof titleId === "string" ? findPlaybackResources(titleId) : null,
    }
    window.postMessage(response, window.location.origin)
  })
}
