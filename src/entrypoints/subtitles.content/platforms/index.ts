export interface ControlsConfig {
  measureHeight: (container: HTMLElement) => number
  checkVisibility: (container: HTMLElement) => boolean
}

export interface PlatformConfig {
  selectors: {
    video: string
    playerContainer: string
    controlsBar: string
    nativeSubtitles: string
  }

  events: {
    navigate?: string
  }

  controls?: ControlsConfig

  getVideoId?: () => string | null
}
