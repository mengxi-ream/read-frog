import type { AdapterContext } from "./adapter-context"
import type { SubtitlesSwitch } from "./subtitles-switch"
import type { SurfaceByFeature } from "@/types/analytics"
import type { SubtitlesPlatform } from "@/types/config/subtitles"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { getLocalConfig } from "@/utils/config/storage"
import { SUBTITLES_SOURCE } from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { showAiSubtitlesWallToast } from "@/utils/subtitles/toast"
import { subtitlesSidebarOpenAtom, subtitlesStore } from "../atoms"

type SubtitlesToggleSource = "manual" | "auto" | "shortcut"

const TOGGLE_SOURCE_SURFACE: Record<SubtitlesToggleSource, SurfaceByFeature["video_subtitles"]> = {
  manual: ANALYTICS_SURFACE.VIDEO_SUBTITLES,
  auto: ANALYTICS_SURFACE.VIDEO_SUBTITLES_AUTO,
  shortcut: ANALYTICS_SURFACE.SHORTCUT,
}

/**
 * Sites where most videos have no captions: auto-start on one of those leaves
 * no loading pill or error behind, and the toggle falls back to off.
 */
const QUIET_AUTO_START_PLATFORMS: ReadonlySet<SubtitlesPlatform> = new Set(["xcom", "bilibili"])

type SubtitlesStartRequestsDeps = Pick<AdapterContext, "config" | "lifecycle" | "getScheduler"> & {
  subtitlesSwitch: Pick<SubtitlesSwitch, "handleToggleSubtitles" | "switchSubtitlesFetcher">
}

export class SubtitlesStartRequests {
  private readonly config: SubtitlesStartRequestsDeps["config"]
  private readonly lifecycle: SubtitlesStartRequestsDeps["lifecycle"]
  private readonly getScheduler: SubtitlesStartRequestsDeps["getScheduler"]
  private readonly subtitlesSwitch: SubtitlesStartRequestsDeps["subtitlesSwitch"]
  private firstPlayStartAbortController: AbortController | null = null

  constructor({ config, lifecycle, getScheduler, subtitlesSwitch }: SubtitlesStartRequestsDeps) {
    this.config = config
    this.lifecycle = lifecycle
    this.getScheduler = getScheduler
    this.subtitlesSwitch = subtitlesSwitch
  }

  async tryAutoStartSubtitles() {
    const generation = this.lifecycle.playerGeneration.current()
    const config = await getLocalConfig()
    if (this.lifecycle.isPlayerSuperseded(generation)) return
    const autoStart = config?.videoSubtitles?.platforms?.[this.config.platform] === "auto"

    const learningOpen = subtitlesStore.get(subtitlesSidebarOpenAtom)

    if (!autoStart && !learningOpen) return

    if (this.config.embedded) {
      const video = this.getScheduler()?.getVideoElement()
      if (!video) return

      if (video.paused) {
        this.cancelFirstPlayStart()
        this.firstPlayStartAbortController = new AbortController()
        video.addEventListener("playing", () => this.toggleSubtitlesWithSource(true, "auto"), {
          once: true,
          signal: this.firstPlayStartAbortController.signal,
        })
        return
      }
    }

    this.toggleSubtitlesWithSource(true, "auto")
  }

  // A choice the reader makes before the first play outranks the automatic start.
  cancelFirstPlayStart() {
    this.firstPlayStartAbortController?.abort()
    this.firstPlayStartAbortController = null
  }

  toggleSubtitlesWithSource(enabled: boolean, source: SubtitlesToggleSource) {
    if (source !== "auto") this.cancelFirstPlayStart()
    this.subtitlesSwitch.handleToggleSubtitles(enabled, {
      analyticsContext: enabled
        ? createFeatureUsageContext(
            ANALYTICS_FEATURE.VIDEO_SUBTITLES,
            TOGGLE_SOURCE_SURFACE[source],
          )
        : undefined,
      // Only an automatic start goes quiet: a reader who asked still hears why nothing came.
      quiet: source === "auto" && QUIET_AUTO_START_PLATFORMS.has(this.config.platform),
    })
  }

  requestAiSubtitles = async (): Promise<void> => {
    if (await this.config.isLiveContent?.()) {
      showAiSubtitlesWallToast(i18n.t("subtitles.errors.aiLiveReplayUnsupported"))
      return
    }
    this.cancelFirstPlayStart()
    return this.subtitlesSwitch.switchSubtitlesFetcher(SUBTITLES_SOURCE.AI)
  }
}
