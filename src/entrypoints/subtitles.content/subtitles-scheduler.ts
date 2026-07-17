import type { StateData, SubtitlesFragment, SubtitlesState } from "@/utils/subtitles/types"
import {
  currentSubtitleAtom,
  currentTimeMsAtom,
  subtitlesStateAtom,
  subtitlesStore,
  subtitlesVisibleAtom,
} from "./atoms"

const ERROR_STATE_AUTO_HIDE_MS = 5_000

export class SubtitlesScheduler {
  private videoElement: HTMLVideoElement
  private subtitles: SubtitlesFragment[] = []
  private currentIndex = -1
  /** Stable identity for sticky active-cue selection across array rewrites. */
  private currentStart: number | null = null
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
   * @param mergeOnly - when true, only update translations on existing cues
   *   (do not insert). Used for on-demand translation results so stale starts
   *   from an in-flight batch cannot reappear after AI re-segmentation.
   */
  supplementSubtitles(subtitles: SubtitlesFragment[], options?: { mergeOnly?: boolean }) {
    if (subtitles.length === 0) {
      return
    }

    const mergeOnly = options?.mergeOnly === true
    const existingMap = new Map(this.subtitles.map((s) => [s.start, s]))
    let currentSubtitleUpdated = false

    for (const newSub of subtitles) {
      const existing = existingMap.get(newSub.start)

      if (!existing) {
        if (mergeOnly) {
          continue
        }
        this.subtitles.push(newSub)
        existingMap.set(newSub.start, newSub)
        continue
      }

      // Apply empty-string translations too (error fallback for bilingual).
      if (newSub.translation !== undefined) {
        // mergeOnly: only paint translations onto cues that still match the
        // translated identity (start+end+text). Prevents a recut shorter line's
        // translation from landing on a protected longer baseline cue that
        // shares the same start time.
        if (mergeOnly && (existing.end !== newSub.end || existing.text !== newSub.text)) {
          continue
        }

        const updatedSub = { ...existing, translation: newSub.translation }
        const idx = this.subtitles.findIndex((s) => s.start === existing.start)
        if (idx >= 0) {
          this.subtitles[idx] = updatedSub
          existingMap.set(existing.start, updatedSub)
        }

        if (this.currentStart !== null && existing.start === this.currentStart) {
          currentSubtitleUpdated = true
        }
      }
    }

    this.subtitles.sort((a, b) => a.start - b.start)
    this.updateSubtitles(this.videoElement.currentTime)

    // Force update store if current subtitle's translation was modified
    if (currentSubtitleUpdated) {
      this.syncCurrentIndexFromStart()
      this.updateCurrentSubtitle()
    }
  }

  /**
   * Replace cues whose start falls in [windowStartMs, windowEndMs] with nextFragments.
   * Protects the currently displayed cue so AI re-segmentation does not jump mid-line.
   */
  replaceTimeWindow(
    windowStartMs: number,
    windowEndMs: number,
    nextFragments: SubtitlesFragment[],
  ) {
    const timeMs = this.videoElement.currentTime * 1000
    const protectedCue = this.getProtectedActiveCue(timeMs)

    this.subtitles = this.subtitles.filter((fragment) => {
      if (protectedCue && fragment.start === protectedCue.start) {
        return true
      }
      return fragment.start < windowStartMs || fragment.start > windowEndMs
    })

    const existingStarts = new Set(this.subtitles.map((fragment) => fragment.start))

    for (const next of nextFragments) {
      if (protectedCue && next.start === protectedCue.start) {
        // Keep the protected original text until its natural end.
        continue
      }
      if (existingStarts.has(next.start)) {
        continue
      }
      this.subtitles.push(next)
      existingStarts.add(next.start)
    }

    this.subtitles.sort((a, b) => a.start - b.start)
    this.updateSubtitles(this.videoElement.currentTime)
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
    this.currentStart = null
    this.updateCurrentSubtitle()
  }

  private getProtectedActiveCue(timeMs: number): SubtitlesFragment | null {
    if (this.currentStart === null) {
      return null
    }

    const current = this.subtitles.find((fragment) => fragment.start === this.currentStart)
    if (!current) {
      return null
    }

    if (current.start <= timeMs && current.end > timeMs) {
      return current
    }

    return null
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

  private syncCurrentIndexFromStart() {
    if (this.currentStart === null) {
      this.currentIndex = -1
      return
    }

    this.currentIndex = this.subtitles.findIndex((fragment) => fragment.start === this.currentStart)
    if (this.currentIndex < 0) {
      this.currentStart = null
    }
  }

  private updateSubtitles(currentTime: number) {
    const timeMs = currentTime * 1000
    subtitlesStore.set(currentTimeMsAtom, timeMs)

    // Sticky: keep the active cue while playback remains inside its range,
    // even if a re-segmented cue also covers this timestamp.
    if (this.currentStart !== null) {
      const sticky = this.subtitles.find((fragment) => fragment.start === this.currentStart)
      if (sticky && sticky.start <= timeMs && sticky.end > timeMs) {
        const stickyIndex = this.subtitles.indexOf(sticky)
        if (stickyIndex !== this.currentIndex) {
          this.currentIndex = stickyIndex
          this.updateCurrentSubtitle()
        }
        return
      }
    }

    const subtitle = this.subtitles.find((sub) => sub.start <= timeMs && sub.end > timeMs)
    const newIndex = subtitle ? this.subtitles.indexOf(subtitle) : -1
    const newStart = subtitle?.start ?? null

    if (newIndex !== this.currentIndex || newStart !== this.currentStart) {
      this.currentIndex = newIndex
      this.currentStart = newStart
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
