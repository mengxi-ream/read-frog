import {
  PRIME_VIDEO_FULLSCREEN_BUTTON_SELECTOR,
  PRIME_VIDEO_SETTINGS_BUTTON_SELECTOR,
} from "@/utils/constants/subtitles"

/** The row of buttons at the top right: the closest box that holds both fullscreen and settings. */
export function findTopRightRow(): Element | null {
  const settings = document.querySelector(PRIME_VIDEO_SETTINGS_BUTTON_SELECTOR)
  if (!settings) return null

  let row = document.querySelector(PRIME_VIDEO_FULLSCREEN_BUTTON_SELECTOR)?.parentElement ?? null
  while (row && !row.contains(settings)) {
    row = row.parentElement
  }
  return row
}
