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

  navigation: {
    event?: string
    getVideoId?: () => string | null
  }

  controls?: ControlsConfig
}
