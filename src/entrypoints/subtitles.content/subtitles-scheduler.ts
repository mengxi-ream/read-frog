import type { StateData, SubtitlesFragment, SubtitlesState } from "@/utils/subtitles/types"
import {
  currentSubtitleAtom,
  currentTimeMsAtom,
  subtitlesStateAtom,
  subtitlesStore,
  subtitlesVisibleAtom,
} from "./atoms"

const ERROR_STATE_AUTO_HIDE_MS = 5_000

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
    this.updateVisibility()
  }

  /**
   * Upsert translated cues by start. New cues are inserted; existing cues get translation updates.
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

      if (newSub.translation !== undefined) {
        const updatedSub = {
          ...existing,
          text: newSub.text,
          end: newSub.end,
          translation: newSub.translation,
        }
        const idx = this.subtitles.findIndex((s) => s.start === existing.start)
        if (idx >= 0) {
          this.subtitles[idx] = updatedSub
          existingMap.set(existing.start, updatedSub)
        }

        if (previousCurrentStart !== null && existing.start === previousCurrentStart) {
          currentSubtitleUpdated = true
        }
      }
    }

    this.subtitles.sort((a, b) => a.start - b.start)
    this.updateSubtitles(this.videoElement.currentTime)

    if (currentSubtitleUpdated) {
      this.updateCurrentSubtitle()
    }
  }

  /**
   * Drop translated cues whose start falls in [windowStartMs, windowEndMs] (inclusive ends
   * matching segmentation window semantics: start in range).
   */
  removeCuesInTimeWindow(windowStartMs: number, windowEndMs: number) {
    const previousLength = this.subtitles.length
    this.subtitles = this.subtitles.filter(
      (fragment) => fragment.start < windowStartMs || fragment.start > windowEndMs,
    )
    if (this.subtitles.length === previousLength) {
      return
    }
    // Force re-resolve: index alone may stay -1 while the atom still holds a removed cue.
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
    this.updateVisibility()
  }

  hide() {
    this.active = false
    this.updateVisibility()
  }

  setState(state: SubtitlesState, data?: Partial<Omit<StateData, "state">>) {
    this.clearErrorAutoHide()
    this.currentState = {
      state,
      message: data?.message,
    }
    this.updateState()

    if (state === "error") {
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
    this.currentIndex = -1
    this.updateCurrentSubtitle()
  }

  private attachListeners() {
    this.videoElement.addEventListener("timeupdate", this.handleTimeUpdate)
    this.videoElement.addEventListener("seeking", this.handleSeeking)
  }

  private detachListeners() {
    this.videoElement.removeEventListener("timeupdate", this.handleTimeUpdate)
    this.videoElement.removeEventListener("seeking", this.handleSeeking)
  }

  private handleTimeUpdate = () => {
    if (!this.active) return

    const currentTime = this.videoElement.currentTime
    this.updateSubtitles(currentTime)
  }

  private handleSeeking = () => {
    if (!this.active) return

    const currentTime = this.videoElement.currentTime
    this.updateSubtitles(currentTime)
  }

  private updateSubtitles(currentTime: number) {
    const timeMs = currentTime * 1000
    subtitlesStore.set(currentTimeMsAtom, timeMs)

    const subtitle = this.subtitles.find((sub) => sub.start <= timeMs && sub.end > timeMs)
    const newIndex = subtitle ? this.subtitles.indexOf(subtitle) : -1

    if (newIndex !== this.currentIndex) {
      this.currentIndex = newIndex
      this.updateCurrentSubtitle()
    }
  }

  private updateCurrentSubtitle() {
    const currentSubtitle = this.currentIndex >= 0 ? this.subtitles[this.currentIndex] : null
    subtitlesStore.set(currentSubtitleAtom, currentSubtitle!)
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
