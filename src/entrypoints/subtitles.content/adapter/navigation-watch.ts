import type { AdapterContext } from "./adapter-context"
import type { SourceSubtitlesCache } from "./source-subtitles-cache"
import type { SubtitlesSession } from "./subtitles-session"
import { NAVIGATION_HANDLER_DELAY } from "@/utils/constants/subtitles"
import { currentVideoIdAtom, subtitlesStore } from "../atoms"

type NavigationWatchDeps = Pick<AdapterContext, "config" | "lifecycle"> & {
  session: Pick<SubtitlesSession, "sessionVideoId">
  sourceCache: Pick<SourceSubtitlesCache, "sourceVideoId">
  onLeaveVideo: () => void
  onNavigated: () => Promise<void>
}

export class NavigationWatch {
  private readonly config: NavigationWatchDeps["config"]
  private readonly lifecycle: NavigationWatchDeps["lifecycle"]
  private readonly session: NavigationWatchDeps["session"]
  private readonly sourceCache: NavigationWatchDeps["sourceCache"]
  private readonly onLeaveVideo: NavigationWatchDeps["onLeaveVideo"]
  private readonly onNavigated: NavigationWatchDeps["onNavigated"]
  private navigationReinitTimeoutId: ReturnType<typeof setTimeout> | null = null
  hasPendingNavigationReset = false
  private navigationVideoId: string | null

  get videoIdChanged() {
    const currentVideoId = this.config.getVideoId?.() ?? null
    const knownVideoId =
      this.navigationVideoId ?? this.session.sessionVideoId ?? this.sourceCache.sourceVideoId
    return knownVideoId !== null && currentVideoId !== knownVideoId
  }

  constructor({
    config,
    lifecycle,
    session,
    sourceCache,
    onLeaveVideo,
    onNavigated,
  }: NavigationWatchDeps) {
    this.config = config
    this.lifecycle = lifecycle
    this.session = session
    this.sourceCache = sourceCache
    this.onLeaveVideo = onLeaveVideo
    this.onNavigated = onNavigated
    this.navigationVideoId = config.getVideoId?.() ?? null
  }

  cancelPendingNavigationReset() {
    this.hasPendingNavigationReset = false
  }

  stop() {
    const { events } = this.config
    if (events.navigateStart) {
      window.removeEventListener(events.navigateStart, this.handleNavigationStart)
    }
    if (events.navigateFinish) {
      window.removeEventListener(events.navigateFinish, this.handleNavigationFinish)
    }

    this.clearNavigationReinitTimeout()
  }

  publishVideoId() {
    this.navigationVideoId = this.config.getVideoId?.() ?? null
    subtitlesStore.set(currentVideoIdAtom, this.navigationVideoId)
  }

  clearNavigationReinitTimeout() {
    if (this.navigationReinitTimeoutId !== null) {
      clearTimeout(this.navigationReinitTimeoutId)
      this.navigationReinitTimeoutId = null
    }
  }

  setupNavigationListeners() {
    const { events } = this.config

    if (events.navigateStart) {
      window.addEventListener(events.navigateStart, this.handleNavigationStart)
    }

    if (events.navigateFinish) {
      window.addEventListener(events.navigateFinish, this.handleNavigationFinish)
    }
  }

  private handleNavigationStart = () => {
    if (!this.videoIdChanged) {
      return
    }

    this.hasPendingNavigationReset = true
    this.onLeaveVideo()
  }

  private handleNavigationFinish = () => {
    if (!this.hasPendingNavigationReset) {
      return
    }

    this.clearNavigationReinitTimeout()
    this.navigationReinitTimeoutId = setTimeout(() => {
      this.navigationReinitTimeoutId = null
      void this.handleNavigation()
    }, NAVIGATION_HANDLER_DELAY)
  }

  notifyNavigation() {
    if (this.lifecycle.destroyed) return
    this.hasPendingNavigationReset = true
    this.onLeaveVideo()

    this.clearNavigationReinitTimeout()
    this.navigationReinitTimeoutId = setTimeout(() => {
      this.navigationReinitTimeoutId = null
      void this.handleNavigation()
    }, NAVIGATION_HANDLER_DELAY)
  }

  private async handleNavigation() {
    // A -> B -> A still needs to restore the state torn down at navigation start.
    if (!this.hasPendingNavigationReset || this.lifecycle.destroyed) {
      return
    }

    this.hasPendingNavigationReset = false
    await this.onNavigated()
  }
}
