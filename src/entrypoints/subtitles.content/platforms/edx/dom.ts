import {
  EDX_ACTIVE_VIDEO_ATTRIBUTE,
  EDX_HTML5_VIDEO_SELECTOR,
  EDX_VIDEO_SELECTOR,
} from "@/utils/constants/subtitles"

// Blocks playing at the last check, to tell one that just started from one already playing.
let playingBefore: ReadonlySet<HTMLElement> = new Set()

/** Marks the HTML5 video block subtitles follow: the one started last, kept while it pauses. */
export function markActiveEdxVideo(): void {
  const blocks = document.querySelectorAll<HTMLElement>(EDX_VIDEO_SELECTOR)
  const html5Blocks = [...blocks].filter((block) => block.querySelector(EDX_HTML5_VIDEO_SELECTOR))
  const playing = html5Blocks.filter((block) => block.classList.contains("is-playing"))
  const active =
    playing.find((block) => !playingBefore.has(block)) ??
    html5Blocks.find((block) => block.hasAttribute(EDX_ACTIVE_VIDEO_ATTRIBUTE)) ??
    playing[0] ??
    html5Blocks[0]
  playingBefore = new Set(playing)

  for (const block of blocks) {
    block.toggleAttribute(EDX_ACTIVE_VIDEO_ATTRIBUTE, block === active)
  }
}
