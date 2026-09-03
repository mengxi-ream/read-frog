import type { AiSubtitlesContext } from "@/utils/subtitles/ai/request-ai-subtitles"

export interface ControlsConfig {
  findVideoContainer?: () => HTMLElement | null
  measureHeight: (container: HTMLElement) => number
  checkVisibility: (container: HTMLElement) => boolean
}

export interface PlatformConfig {
  embedded?: boolean
  silentErrors?: boolean
  containerShrinkRatio?: (container: HTMLElement) => number | null

  selectors: {
    video: string
    playerContainer: string
    controlsBar?: string
    nativeSubtitles: string
  }

  events: {
    navigateStart?: string
    navigateFinish?: string
  }

  controls?: ControlsConfig

  getVideoId?: () => string | null

  createAiSubtitlesContext?: () => AiSubtitlesContext | null

  isLiveContent?: () => Promise<boolean>

  /**
   * When true, the host player is showing an ad. Overlay captions for the main
   * video should be suppressed until the ad ends.
   */
  isAdPlaying?: (playerContainer: HTMLElement) => boolean
}
