import type { SubtitlesFetcher } from "../types"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { NoSubtitlesError } from "@/utils/subtitles/errors"
import { toSubtitlesFragments } from "../fragments"

export interface SubtitlesTrack {
  language: string
  /** As the site gives them, in milliseconds; the fetcher cleans the text. */
  fragments: SubtitlesFragment[]
}

export interface SubtitlesTrackSource {
  /** Names the track the page is on now, so a change of video or track shows as a new key. */
  currentKey: () => string | null
  /** Throws a `SubtitlesError` when the track cannot be loaded. */
  load: (key: string) => Promise<SubtitlesTrack>
}

/** For sites that serve a whole subtitle file: one load per track, shared by check and fetch. */
export class TrackSubtitlesFetcher implements SubtitlesFetcher {
  // Kept after a failed load, so a track poll does not ask the site again on every tick.
  private trackKey: string | null = null
  private trackLoad: Promise<SubtitlesTrack> | null = null
  private sourceLanguage = ""

  constructor(private readonly source: SubtitlesTrackSource) {}

  async fetch(): Promise<SubtitlesFragment[]> {
    const key = this.source.currentKey()
    if (key === null) {
      throw new NoSubtitlesError()
    }

    const load = this.load(key)
    const track = await load.catch((error: unknown) => {
      // A failure is reported once; asking again asks the site again.
      if (this.trackLoad === load) this.trackLoad = null
      throw error
    })
    this.sourceLanguage = track.language
    return track.fragments
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  // Only the file says whether a video has subtitles, so checking loads it, and `fetch` reuses that
  // load. A file of blank lines counts as none; any other failure is left for `fetch` to report.
  async hasAvailableSubtitles(): Promise<boolean> {
    const key = this.source.currentKey()
    if (key === null) return false
    return this.load(key).then(
      (track) => track.fragments.length > 0,
      (error: unknown) => !(error instanceof NoSubtitlesError),
    )
  }

  private load(key: string): Promise<SubtitlesTrack> {
    if (this.trackKey !== key || !this.trackLoad) {
      this.trackKey = key
      this.trackLoad = this.source.load(key).then(({ language, fragments }) => ({
        language,
        fragments: toSubtitlesFragments(fragments),
      }))
    }
    return this.trackLoad
  }

  async shouldUseSameTrack(): Promise<boolean> {
    return this.trackKey !== null && this.source.currentKey() === this.trackKey
  }

  cleanup(): void {
    this.trackKey = null
    this.trackLoad = null
    this.sourceLanguage = ""
  }
}
