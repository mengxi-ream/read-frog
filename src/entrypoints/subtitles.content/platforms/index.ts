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

  getVideoId?: () => string | null
}
