import { EDX_ACTIVE_VIDEO_SELECTOR } from "@/utils/constants/subtitles"

/** The usage id of the video block subtitles follow, as `markActiveEdxVideo` marks it. */
export function getEdxVideoId(): string | null {
  return document.querySelector<HTMLElement>(EDX_ACTIVE_VIDEO_SELECTOR)?.dataset.blockId ?? null
}
