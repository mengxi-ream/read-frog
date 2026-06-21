export interface ControlsConfig {
  findVideoContainer?: () => HTMLElement | null
  measureHeight: (container: HTMLElement) => number
  checkVisibility: (container: HTMLElement) => boolean
}

export type SubtitlesPanelPlacement = "above" | "left"

export interface PlatformConfig {
  embedded?: boolean
  silentErrors?: boolean
  subtitlesPanelPlacement?: SubtitlesPanelPlacement
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
}
