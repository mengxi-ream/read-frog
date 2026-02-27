import type { StateData, SubtitlesFragment, SubtitlesState } from "@/utils/subtitles/types"
import { currentSubtitleAtom, currentTimeMsAtom, subtitlesStateAtom, subtitlesStore, subtitlesVisibleAtom } from "./atoms"

const ERROR_STATE_AUTO_HIDE_MS = 5_000

export class SubtitlesScheduler {
  private videoElement: HTMLVideoElement
  private subtitles: SubtitlesFragment[] = []
  private currentIndex = -1
  private isActive = false
  private currentState: StateData = {
    state: "idle",
  }

  private errorAutoHideTimeoutId: ReturnType<typeof setTimeout> | null = null

  constructor({ videoElement }: { videoElement: HTMLVideoElement }) {
    this.videoElement = videoElement
    this.attachListeners()
  }

  start() {
    this.isActive = true
    this.updateVisibility()
  }

  supplementSubtitles(subtitles: SubtitlesFragment[]) {
    if (subtitles.length === 0) {
      return
    }

    const existingMap = new Map(this.subtitles.map(s => [s.start, s]))
    const currentSubtitle = this.currentIndex >= 0 ? this.subtitles[this.currentIndex] : null
    let currentSubtitleUpdated = false

    for (const newSub of subtitles) {
      const existing = existingMap.get(newSub.start)

      if (!existing) {
        this.subtitles.push(newSub)
        continue
      }

      if (newSub.translation) {
        const updatedSub = { ...existing, translation: newSub.translation }
        const idx = this.subtitles.findIndex(s => s.start === existing.start)
        if (idx >= 0) {
          this.subtitles[idx] = updatedSub
        }

        if (currentSubtitle && existing.start === currentSubtitle.start) {
          currentSubtitleUpdated = true
        }
      }
    }

    this.subtitles.sort((a, b) => a.start - b.start)
    this.updateSubtitles(this.videoElement.currentTime)

    // Force update store if current subtitle's translation was modified
    if (currentSubtitleUpdated) {
      this.updateCurrentSubtitle()
    }
  }

  getVideoElement(): HTMLVideoElement {
    return this.videoElement
  }

  getState(): SubtitlesState {
    return this.currentState.state ?? "idle"
  }

  stop() {
    this.isActive = false
    this.detachListeners()
    this.updateVisibility()
  }

  show() {
    this.isActive = true
    this.updateVisibility()
  }

  hide() {
    this.isActive = false
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
    if (!this.isActive)
      return

    const currentTime = this.videoElement.currentTime
    this.updateSubtitles(currentTime)
  }

  private handleSeeking = () => {
    if (!this.isActive)
      return

    const currentTime = this.videoElement.currentTime
    this.updateSubtitles(currentTime)
  }

  private updateSubtitles(currentTime: number) {
    const timeMs = currentTime * 1000
    subtitlesStore.set(currentTimeMsAtom, timeMs)

    const subtitle = this.subtitles.find(sub => sub.start <= timeMs && sub.end > timeMs)
    const newIndex = subtitle ? this.subtitles.indexOf(subtitle) : -1

    if (newIndex !== this.currentIndex) {
      this.currentIndex = newIndex
      this.updateCurrentSubtitle()
    }
  }

  private updateCurrentSubtitle() {
    const currentSubtitle = this.currentIndex >= 0 ? this.subtitles[this.currentIndex] : null
    subtitlesStore.set(currentSubtitleAtom, currentSubtitle)
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
    subtitlesStore.set(subtitlesVisibleAtom, this.isActive)
  }
}
