import {
  EDX_ACTIVE_VIDEO_ATTRIBUTE,
  EDX_HTML5_VIDEO_SELECTOR,
  EDX_VIDEO_SELECTOR,
} from "@/utils/constants/subtitles"

/**
 * A unit can hold several video blocks. Subtitles follow the one last played, so pausing it does
 * not send them back to the first. A block that plays from YouTube has an iframe, not a `<video>`,
 * so it is skipped.
 */
export function markActiveEdxVideo(): void {
  const blocks = document.querySelectorAll<HTMLElement>(EDX_VIDEO_SELECTOR)
  const html5Blocks = [...blocks].filter((block) => block.querySelector(EDX_HTML5_VIDEO_SELECTOR))
  const active =
    html5Blocks.find((block) => block.classList.contains("is-playing")) ??
    html5Blocks.find((block) => block.hasAttribute(EDX_ACTIVE_VIDEO_ATTRIBUTE)) ??
    html5Blocks[0]

  for (const block of blocks) {
    block.toggleAttribute(EDX_ACTIVE_VIDEO_ATTRIBUTE, block === active)
  }
}
