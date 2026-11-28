import {
  PRIME_VIDEO_TITLE_ID_ATTRIBUTE,
  PRIME_VIDEO_VIDEO_SELECTOR,
} from "@/utils/constants/subtitles"

/** The title Prime's open player plays, as the page script marks it on the video. */
export function getPrimeVideoTitleId(): string | null {
  const video = document.querySelector(PRIME_VIDEO_VIDEO_SELECTOR)
  // Closing the player only hides it, with its video still loaded and marked.
  return video && video.getClientRects().length > 0
    ? video.getAttribute(PRIME_VIDEO_TITLE_ID_ATTRIBUTE)
    : null
}
