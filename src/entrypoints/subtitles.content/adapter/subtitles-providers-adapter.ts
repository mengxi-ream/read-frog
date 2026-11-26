import type { ControlsConfig } from "@/entrypoints/subtitles.content/platforms"
import type { Config } from "@/types/config/config"
import type { SubtitlesPlatform } from "@/types/config/subtitles"

export interface SubtitlesProvidersAdapter {
  /** Which site's player this is; the settings panel's auto-start switch sets this site's mode. */
  readonly platform: SubtitlesPlatform
  readonly embedded: boolean | undefined
  readonly containerShrinkRatio: ((container: HTMLElement) => number | null) | undefined
  readonly supportsAiSubtitles: boolean
  getControlsConfig: () => ControlsConfig | undefined
  readonly supportsSidebar: boolean
  generateVideoSummary: (config: Config, videoId?: string | null) => Promise<string | null>
  hasSubtitlesAvailable: () => Promise<boolean>
  ensureSourceTrackPublished: () => Promise<void>
  seekTo: (seconds: number) => void
  getVideoElement: () => HTMLVideoElement | null
  /** The platform's link to the playing video, when the page URL does not name it. */
  getVideoPageUrl: () => string | null
  toggleSubtitlesManually: (enabled: boolean) => void
  toggleSubtitlesByShortcut: (enabled: boolean) => void
  requestAiSubtitles: () => Promise<void>
  downloadSourceSubtitles: () => Promise<void>
  downloadTranslatedSubtitles: () => Promise<void>
}
