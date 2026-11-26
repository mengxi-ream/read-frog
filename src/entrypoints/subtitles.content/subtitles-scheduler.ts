import type { StateData, SubtitlesFragment, SubtitlesState } from "@/utils/subtitles/types"
import {
  adPlayingAtom,
  currentSubtitleAtom,
  currentTimeMsAtom,
  subtitlesStateAtom,
  subtitlesStore,
  translatedTrackAtom,
  subtitlesVisibleAtom,
  videoLoadingAtom,
} from "./atoms"

const ERROR_STATE_AUTO_HIDE_MS = 5_000

function cueIdentityKey(fragment: Pick<SubtitlesFragment, "start" | "end" | "text">): string {
  return `${fragment.start}\0${fragment.end}\0${fragment.text}`
}

/** The provider's own translation outranks a machine one. */
function translationRank(fragment: SubtitlesFragment): number {
  if (fragment.translation === undefined) return 0
  if (fragment.placeholder === "machine") return 1
  return 2
}

/**
 * Holds only *translated* cues. Originals live on sourceTrackAtom; the UI falls back there.
 */
export class SubtitlesScheduler {
  private videoElement: HTMLVideoElement
  private subtitles: SubtitlesFragment[] = []
  private currentIndex = -1
  private active = false
  private currentState: StateData = {
    state: "idle",
  }

  private errorAutoHideTimeoutId: ReturnType<typeof setTimeout> | null = null

  constructor({ videoElement }: { videoElement: HTMLVideoElement }) {
    this.videoElement = videoElement
    this.attachListeners()
  }

  start() {
    this.active = true
    // Sync immediately: timeupdate may not fire while paused / mid-video.
    this.updateSubtitles(this.videoElement.currentTime)
    this.updateVisibility()
  }

  /**
   * Upsert translated cues by start. New cues are inserted; an existing cue takes the new
   * translation unless it already has a better one (`translationRank`).
   */
  supplementSubtitles(subtitles: SubtitlesFragment[]) {
    if (subtitles.length === 0) {
      return
    }

    const existingMap = new Map(this.subtitles.map((s) => [s.start, s]))
    let currentSubtitleUpdated = false
    const previousCurrentStart =
      this.currentIndex >= 0 ? (this.subtitles[this.currentIndex]?.start ?? null) : null

    for (const newSub of subtitles) {
      const existing = existingMap.get(newSub.start)

      if (!existing) {
        this.subtitles.push(newSub)
        existingMap.set(newSub.start, newSub)
        continue
      }

      if (newSub.translation === undefined || translationRank(newSub) < translationRank(existing)) {
        continue
      }

      const idx = this.subtitles.findIndex((s) => s.start === existing.start)
      if (idx >= 0) {
        this.subtitles[idx] = newSub
        existingMap.set(existing.start, newSub)
      }

      if (previousCurrentStart !== null && existing.start === previousCurrentStart) {
        currentSubtitleUpdated = true
      }
    }

    this.subtitles.sort((a, b) => a.start - b.start)
    this.publishTranslatedTrack()
    this.updateSubtitles(this.videoElement.currentTime)

    if (currentSubtitleUpdated) {
      this.updateCurrentSubtitle()
    }
  }

  /**
   * After AI recut of a window: drop overlapping translated cues, but re-attach translations
   * whose start+end+text still match a next fragment. Unchanged cues must not be wiped then
   * skipped forever (coordinator still has them in translatedStarts).
   */
  reconcileTranslatedCuesAfterRecut(
    windowStartMs: number,
    windowEndMs: number,
    nextFragments: SubtitlesFragment[],
  ) {
    const outside = this.subtitles.filter(
      (fragment) => fragment.end <= windowStartMs || fragment.start >= windowEndMs,
    )
    const overlapping = this.subtitles.filter(
      (fragment) => fragment.end > windowStartMs && fragment.start < windowEndMs,
    )

    const byIdentity = new Map(
      overlapping.map((fragment) => [cueIdentityKey(fragment), fragment] as const),
    )
    const preserved = nextFragments.flatMap((fragment) => {
      const previous = byIdentity.get(cueIdentityKey(fragment))
      if (previous?.translation === undefined) {
        return []
      }
      return [
        {
          ...fragment,
          translation: previous.translation,
          ...(previous.placeholder && { placeholder: previous.placeholder }),
        },
      ]
    })

    const next = [...outside, ...preserved].sort((a, b) => a.start - b.start)
    const unchanged =
      next.length === this.subtitles.length &&
      next.every((fragment, index) => {
        const prev = this.subtitles[index]
        if (!prev) return false
        return (
          prev.start === fragment.start &&
          prev.end === fragment.end &&
          prev.text === fragment.text &&
          prev.translation === fragment.translation &&
          prev.placeholder === fragment.placeholder
        )
      })
    if (unchanged) {
      return
    }

    this.subtitles = next
    this.publishTranslatedTrack()
    // Force re-resolve: index alone may stay stale while the atom still holds a removed cue.
    this.currentIndex = -1
    this.updateSubtitles(this.videoElement.currentTime)
    this.updateCurrentSubtitle()
  }

  /** Translation holds: every machine translation goes, the one on screen included. */
  removeMachineTranslations() {
    const kept = this.subtitles.filter((fragment) => fragment.placeholder !== "machine")
    if (kept.length === this.subtitles.length) {
      return
    }

    this.subtitles = kept
    this.publishTranslatedTrack()
    this.currentIndex = -1
    this.updateSubtitles(this.videoElement.currentTime)
    this.updateCurrentSubtitle()
  }

  getVideoElement(): HTMLVideoElement {
    return this.videoElement
  }

  getState(): SubtitlesState {
    return this.currentState.state ?? "idle"
  }

  isActive(): boolean {
    return this.active
  }

  stop() {
    this.active = false
    this.detachListeners()
    this.updateVisibility()
  }

  show() {
    this.active = true
    // Sync immediately: timeupdate may not fire while paused / mid-video.
    this.updateSubtitles(this.videoElement.currentTime)
    this.updateVisibility()
  }

  hide() {
    this.active = false
    this.updateVisibility()
  }

  /** Force a cue resolve from the live video clock (e.g. after an ad ends). */
  resyncFromVideo() {
    if (!this.active) return
    this.updateSubtitles(this.videoElement.currentTime)
  }

  setState(state: SubtitlesState, data?: Omit<StateData, "state">) {
    this.clearErrorAutoHide()
    this.currentState = { state, ...data }
    this.updateState()

    if (state === "error" && !data?.persistent) {
      this.errorAutoHideTimeoutId = setTimeout(() => {
        if (this.currentState.state === "error") {
          this.setState("idle")
        }
      }, ERROR_STATE_AUTO_HIDE_MS)
    }
  }

  reset() {
    this.setState("idle")
    this.subtitles = []
    this.publishTranslatedTrack()
    this.currentIndex = -1
    this.updateCurrentSubtitle()
  }

  private attachListeners() {
    this.videoElement.addEventListener("timeupdate", this.handleTimeUpdate)
    this.videoElement.addEventListener("seeking", this.handleSeeking)
    // The video empties as it swaps media, and has a picture again once the new media loads.
    this.videoElement.addEventListener("emptied", this.handleMediaChange)
    this.videoElement.addEventListener("loadeddata", this.handleMediaChange)
  }

  private detachListeners() {
    this.videoElement.removeEventListener("timeupdate", this.handleTimeUpdate)
    this.videoElement.removeEventListener("seeking", this.handleSeeking)
    this.videoElement.removeEventListener("emptied", this.handleMediaChange)
    this.videoElement.removeEventListener("loadeddata", this.handleMediaChange)
  }

  private handleTimeUpdate = () => {
    this.updateSubtitles(this.videoElement.currentTime)
  }

  private handleSeeking = () => {
    this.updateSubtitles(this.videoElement.currentTime)
  }

  private handleMediaChange = () => {
    this.updateSubtitles(this.videoElement.currentTime)
  }

  private updateSubtitles(currentTime: number) {
    const timeMs = currentTime * 1000
    // HAVE_NOTHING: the video is between media, as on a part switch.
    subtitlesStore.set(videoLoadingAtom, this.videoElement.readyState === 0)
    // Published whether or not captions are showing: the transcript follows
    // playback even when the user never turned subtitle translation on. An ad
    // plays through the same element, so its clock is not the video's.
    if (!subtitlesStore.get(adPlayingAtom)) {
      subtitlesStore.set(currentTimeMsAtom, timeMs)
    }

    if (!this.active) {
      return
    }

    const subtitle = this.subtitles.find((sub) => sub.start <= timeMs && sub.end > timeMs)
    const newIndex = subtitle ? this.subtitles.indexOf(subtitle) : -1

    if (newIndex !== this.currentIndex) {
      this.currentIndex = newIndex
      this.updateCurrentSubtitle()
    }
  }

  private publishTranslatedTrack() {
    subtitlesStore.set(translatedTrackAtom, [...this.subtitles])
  }

  private updateCurrentSubtitle() {
    const next = this.currentIndex >= 0 ? (this.subtitles[this.currentIndex] ?? null) : null
    const shown = subtitlesStore.get(currentSubtitleAtom)
    // A cue on screen does not switch from its machine translation to the AI's: it plays
    // out as it is, and shows the AI's the next time. A recut cue is another cue.
    if (
      next &&
      shown?.placeholder === "machine" &&
      next.placeholder === undefined &&
      cueIdentityKey(shown) === cueIdentityKey(next)
    ) {
      return
    }
    subtitlesStore.set(currentSubtitleAtom, next)
  }

  private updateState() {
    const stateData = this.currentState.state !== "idle" ? this.currentState : null
    subtitlesStore.set(subtitlesStateAtom, stateData)
  }

  private clearErrorAutoHide() {
    if (this.errorAutoHideTimeoutId !== null) {
      clearTimeout(this.errorAutoHideTimeoutId)
      this.errorAutoHideTimeoutId = null
    }
  }

  private updateVisibility() {
    subtitlesStore.set(subtitlesVisibleAtom, this.active)
  }
}
