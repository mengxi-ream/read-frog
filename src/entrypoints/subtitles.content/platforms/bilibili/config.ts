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

const BILIBILI_VIDEO_SELECTOR = `${BILIBILI_VIDEO_AREA_SELECTOR} video`

// Sent under its BV page, even from an av link: the server keys a part by its cid.
async function createBilibiliAiSubtitlesContext(): Promise<AiSubtitlesContext | null> {
  const partId = getBilibiliPartId()
  const part = partId ? await requestBilibiliPlayingPart(partId) : null
  return part
    ? resolveAiSubtitlesContext({
        url: `https://www.bilibili.com/video/${part.bvid}/?p=${part.p}`,
        mediaId: String(part.cid),
        video: document.querySelector<HTMLVideoElement>(BILIBILI_VIDEO_SELECTOR),
      })
    : null
}

export function getBilibiliConfig(): PlatformConfig {
  return {
    platform: "bilibili",
    selectors: {
      video: BILIBILI_VIDEO_SELECTOR,
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
