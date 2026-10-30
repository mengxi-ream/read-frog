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

/**
 * A fetcher for sites whose subtitles arrive as a whole file. The adapter keeps the subtitles it
 * loaded, so this only remembers which track they came from.
 */
export class TrackSubtitlesFetcher implements SubtitlesFetcher {
  private loadedKey: string | null = null
  private sourceLanguage = ""

  constructor(private readonly source: SubtitlesTrackSource) {}

  async fetch(): Promise<SubtitlesFragment[]> {
    const key = this.source.currentKey()
    if (key === null) {
      throw new NoSubtitlesError()
    }

    const track = await this.source.load(key)
    this.loadedKey = key
    this.sourceLanguage = track.language
    return toSubtitlesFragments(track.fragments)
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    return this.source.currentKey() !== null
  }

  async shouldUseSameTrack(): Promise<boolean> {
    return this.loadedKey !== null && this.source.currentKey() === this.loadedKey
  }

  cleanup(): void {
    this.loadedKey = null
    this.sourceLanguage = ""
  }
}
