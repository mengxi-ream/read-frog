import type { SubtitlesFetcher } from "../types"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import {
  TEXT_TRACK_CUE_POLL_INTERVAL_MS,
  TEXT_TRACK_CUE_WAIT_TIMEOUT_MS,
  TEXT_TRACK_NATIVE_REHIDE_DELAY_MS,
} from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { OverlaySubtitlesError } from "@/utils/subtitles/errors"
import { cuesToFragments } from "./cues"

export interface TextTrackFetcherOptions {
  resolveVideo: () => HTMLVideoElement | null
  getVideoId: () => string | null
}

const SUBTITLE_KINDS = new Set<TextTrackKind>(["subtitles", "captions"])

function selectTrack(video: HTMLVideoElement): TextTrack | null {
  const candidates = Array.from(video.textTracks).filter((track) => SUBTITLE_KINDS.has(track.kind))
  return (
    candidates.find((track) => track.mode === "showing") ??
    candidates.find((track) => track.kind === "subtitles") ??
    candidates[0] ??
    null
  )
}

export class TextTrackFetcher implements SubtitlesFetcher {
  private subtitles: SubtitlesFragment[] = []
  private sourceLanguage = ""
  private cachedTrackHash: string | null = null
  private originalModes = new Map<TextTrack, TextTrackMode>()
  private rehideTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private options: TextTrackFetcherOptions) {}

  async fetch(): Promise<SubtitlesFragment[]> {
    const video = this.options.resolveVideo()
    if (!video) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.videoNotFound"))
    }

    const track = selectTrack(video)
    if (!track) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }

    const trackHash = this.buildTrackHash(track)
    if (this.subtitles.length > 0 && this.cachedTrackHash === trackHash) {
      return this.subtitles
    }

    this.ensureLoading(track)
    const fragments = cuesToFragments(await this.waitForCues(track))
    if (fragments.length === 0) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }

    this.subtitles = fragments
    this.sourceLanguage = track.language
    this.cachedTrackHash = trackHash

    return fragments
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    const video = this.options.resolveVideo()
    const track = video ? selectTrack(video) : null
    if (!track) {
      return false
    }

    this.ensureLoading(track)
    return true
  }

  async shouldUseSameTrack(): Promise<boolean> {
    if (this.subtitles.length === 0 || !this.cachedTrackHash) {
      return false
    }

    const video = this.options.resolveVideo()
    const track = video ? selectTrack(video) : null
    return !!track && this.buildTrackHash(track) === this.cachedTrackHash
  }

  hideNativeSubtitles(): void {
    this.hideShowingTracks()
    this.clearRehideTimer()
    this.rehideTimer = setTimeout(() => {
      this.rehideTimer = null
      this.hideShowingTracks()
    }, TEXT_TRACK_NATIVE_REHIDE_DELAY_MS)
  }

  showNativeSubtitles(): void {
    this.clearRehideTimer()
    for (const [track, mode] of this.originalModes) {
      track.mode = mode
    }
    this.originalModes.clear()
  }

  cleanup(): void {
    this.showNativeSubtitles()
    this.subtitles = []
    this.sourceLanguage = ""
    this.cachedTrackHash = null
  }

  private buildTrackHash(track: TextTrack): string {
    return [this.options.getVideoId() ?? "", track.language, track.label, track.kind].join(":")
  }

  private setMode(track: TextTrack, mode: TextTrackMode): void {
    if (!this.originalModes.has(track)) {
      this.originalModes.set(track, track.mode)
    }
    track.mode = mode
  }

  private ensureLoading(track: TextTrack): void {
    if (track.mode === "disabled") {
      this.setMode(track, "hidden")
    }
  }

  private hideShowingTracks(): void {
    const video = this.options.resolveVideo()
    if (!video) {
      return
    }

    for (const track of Array.from(video.textTracks)) {
      if (track.mode === "showing") {
        this.setMode(track, "hidden")
      }
    }
  }

  private clearRehideTimer(): void {
    if (this.rehideTimer !== null) {
      clearTimeout(this.rehideTimer)
      this.rehideTimer = null
    }
  }

  private waitForCues(track: TextTrack): Promise<TextTrackCueList> {
    const loaded = () => (track.cues && track.cues.length > 0 ? track.cues : null)
    const ready = loaded()
    if (ready) {
      return Promise.resolve(ready)
    }

    return new Promise((resolve, reject) => {
      const finish = (cues: TextTrackCueList | null) => {
        clearTimeout(timeoutId)
        clearInterval(intervalId)
        track.removeEventListener("cuechange", check)
        if (cues) {
          resolve(cues)
        } else {
          reject(new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound")))
        }
      }

      const check = () => {
        const cues = loaded()
        if (cues) {
          finish(cues)
        }
      }

      const timeoutId = setTimeout(() => finish(loaded()), TEXT_TRACK_CUE_WAIT_TIMEOUT_MS)
      const intervalId = setInterval(check, TEXT_TRACK_CUE_POLL_INTERVAL_MS)
      track.addEventListener("cuechange", check)
    })
  }
}
