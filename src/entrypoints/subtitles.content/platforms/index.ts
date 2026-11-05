import type { SubtitlesPlatform } from "@/types/config/subtitles"
import type { AiSubtitlesContext } from "@/utils/subtitles/ai/request-ai-subtitles"

export interface ControlsConfig {
  findVideoContainer?: () => HTMLElement | null
  measureHeight: (container: HTMLElement) => number
  checkVisibility: (container: HTMLElement) => boolean
}

export interface PlatformConfig {
  /** Which site's player this is; picks that site's translate-on-open switch. */
  platform: SubtitlesPlatform
  embedded?: boolean
  silentErrors?: boolean
  containerShrinkRatio?: (container: HTMLElement) => number | null
  subtitlesZIndex?: number

  selectors: {
    video: string
    playerContainer: string
    controlsBar?: string
    nativeSubtitles?: string
  }

  events: {
    navigateStart?: string
    navigateFinish?: string
  }

  controls?: ControlsConfig

  supportsSidebar?: boolean

  getVideoId?: () => string | null

  /**
   * A link to the video playing now, for a note saved from its subtitles.
   * Needed where the page URL does not name the video (a timeline, a reply's
   * video); without it the page URL is used.
   */
  getVideoPageUrl?: () => string | null

  createAiSubtitlesContext?: () => AiSubtitlesContext | null

  isLiveContent?: () => Promise<boolean>

  /**
   * When true, the host player is showing an ad. Overlay captions for the main
   * video should be suppressed until the ad ends.
   */
  isAdPlaying?: (playerContainer: HTMLElement) => boolean
}
