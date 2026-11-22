import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import type { AiSubtitlesContext } from "@/utils/subtitles/ai/request-ai-subtitles"
import {
  BILIBILI_CONTROL_BUTTON_HEIGHT,
  BILIBILI_CONTROLS_BAR_SELECTOR,
  BILIBILI_CONTROLS_SELECTOR,
  BILIBILI_NATIVE_SUBTITLES_SELECTOR,
  BILIBILI_PLAYER_SELECTOR,
  BILIBILI_VIDEO_AREA_SELECTOR,
  DEFAULT_CONTROLS_HEIGHT,
} from "@/utils/constants/subtitles"
import { resolveAiSubtitlesContext } from "@/utils/subtitles/ai/ai-subtitles-context"
import { requestBilibiliPlayingPart } from "@/utils/subtitles/fetchers/bilibili/playing-part"
import { getBilibiliPartId } from "@/utils/subtitles/video-id"

const PART_ID_SEPARATOR = ":"

// The BV page, even for an av link: the server keys a part by its cid and reads only BV pages.
function bilibiliPartUrl({ bvid, partId }: { bvid: string; partId: string }): string {
  const part = partId.slice(partId.lastIndexOf(PART_ID_SEPARATOR) + 1)
  return `https://www.bilibili.com/video/${bvid}/?p=${part}`
}

async function createBilibiliAiSubtitlesContext(): Promise<AiSubtitlesContext | null> {
  const partId = getBilibiliPartId()
  const part = partId ? await requestBilibiliPlayingPart(partId) : null
  return part && partId
    ? resolveAiSubtitlesContext({
        url: bilibiliPartUrl({ bvid: part.bvid, partId }),
        mediaId: String(part.cid),
        video: document.querySelector<HTMLVideoElement>(`${BILIBILI_VIDEO_AREA_SELECTOR} video`),
      })
    : null
}

export function getBilibiliConfig(): PlatformConfig {
  return {
    platform: "bilibili",
    selectors: {
      video: `${BILIBILI_VIDEO_AREA_SELECTOR} video`,
      playerContainer: BILIBILI_VIDEO_AREA_SELECTOR,
      controlsBar: BILIBILI_CONTROLS_BAR_SELECTOR,
      nativeSubtitles: BILIBILI_NATIVE_SUBTITLES_SELECTOR,
    },
    events: {},
    controls: {
      // The player container, not the video area, says whether the controls are hidden.
      findVideoContainer: () => document.querySelector<HTMLElement>(BILIBILI_PLAYER_SELECTOR),
      measureHeight: (container) =>
        container.querySelector(BILIBILI_CONTROLS_SELECTOR)?.getBoundingClientRect().height ??
        DEFAULT_CONTROLS_HEIGHT,
      checkVisibility: (container) => container.dataset.ctrlHidden !== "true",
      observe: { attributes: true, attributeFilter: ["data-ctrl-hidden"] },
    },
    translateButtonHeight: BILIBILI_CONTROL_BUTTON_HEIGHT,
    getVideoId: getBilibiliPartId,
    createAiSubtitlesContext: createBilibiliAiSubtitlesContext,
  }
}
