export interface ControlsConfig {
  findVideoContainer?: () => HTMLElement | null
  measureHeight: (container: HTMLElement) => number
  checkVisibility: (container: HTMLElement) => boolean
}

export interface PlatformConfig {
  embedded?: boolean

  selectors: {
    video: string
    playerContainer: string
    controlsBar: string
    nativeSubtitles: string
  }

  events: {
    navigateStart?: string
    navigateFinish?: string
  }

  controls?: ControlsConfig

  getVideoId?: () => string | null
}
