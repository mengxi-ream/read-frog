import type { StateData, SubtitlesFragment, SubtitlesState } from '@/utils/subtitles/types'
import { currentSubtitleAtom, currentTimeMsAtom, subtitlesStateAtom, subtitlesStore, subtitlesVisibleAtom } from './atoms'

export class SubtitlesScheduler {
  private videoElement: HTMLVideoElement
  private subtitles: SubtitlesFragment[] = []
  private currentIndex = -1
  private isActive = false
  private currentState: StateData = {
    state: 'idle',
  }

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

    const existingStarts = new Set(this.subtitles.map(s => s.start))
    const newSubtitles = subtitles.filter(s => !existingStarts.has(s.start))

    this.subtitles.push(...newSubtitles)
    this.subtitles.sort((a, b) => a.start - b.start)

    this.updateSubtitles(this.videoElement.currentTime)
  }

  getVideoElement(): HTMLVideoElement {
    return this.videoElement
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

  setState(state: SubtitlesState, data?: Partial<Omit<StateData, 'state'>>) {
    this.currentState = {
      state,
      message: data?.message,
    }
    this.updateState()
  }

  reset() {
    this.setState('idle')
    this.subtitles = []
    this.currentIndex = -1
    this.updateCurrentSubtitle()
  }

  private attachListeners() {
    this.videoElement.addEventListener('timeupdate', this.handleTimeUpdate)
    this.videoElement.addEventListener('seeking', this.handleSeeking)
  }

  private detachListeners() {
    this.videoElement.removeEventListener('timeupdate', this.handleTimeUpdate)
    this.videoElement.removeEventListener('seeking', this.handleSeeking)
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
    const stateData = this.currentState.state !== 'idle' ? this.currentState : null
    subtitlesStore.set(subtitlesStateAtom, stateData)
  }

  private updateVisibility() {
    subtitlesStore.set(subtitlesVisibleAtom, this.isActive)
  }
}
