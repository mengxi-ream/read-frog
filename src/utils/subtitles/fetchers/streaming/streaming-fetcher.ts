import type { SubtitlesFetcher } from "../types"
import type { SubtitlesFragment } from "@/utils/subtitles/types"

export interface StreamingTrack {
  id?: string
  url?: string
  language?: string
  label?: string
  kind?: string
  pagePath?: string
}

export interface StreamingSiteAdapter {
  id: string
  matches: (url: URL) => boolean
  discoverTracks: () => Promise<StreamingTrack[]>
  fetchTrack: (track: StreamingTrack) => Promise<SubtitlesFragment[]>
  startLiveCapture?: (onFragments: (fragments: SubtitlesFragment[]) => void) => (() => void) | void
  cleanup?: () => void
}

export function selectSourceTrack(tracks: StreamingTrack[]): StreamingTrack | null {
  const english = tracks.filter(track => /^en\b/i.test(track.language ?? "") || /\bEnglish\b|英語/i.test(track.label ?? ""))
  return english.find(track => /assistive|caption|closed\s*caption|\bcc\b|sdh/i.test(`${track.kind ?? ""} ${track.label ?? ""}`))
    ?? english[0]
    // No English track: fall back to the primary (non-forced) track for translation.
    ?? tracks.find(track => !/forced/i.test(`${track.kind ?? ""} ${track.label ?? ""}`))
    ?? tracks[0]
    ?? null
}

export class StreamingSubtitlesFetcher implements SubtitlesFetcher {
  private readonly site: StreamingSiteAdapter
  private sourceLanguage = ""
  private subtitles: SubtitlesFragment[] = []
  private cachedPagePath: string | null = null

  constructor(site: StreamingSiteAdapter) {
    this.site = site
  }

  async fetch(): Promise<SubtitlesFragment[]> {
    this.subtitles = []
    this.cachedPagePath = null

    const tracks = await this.site.discoverTracks()
    const source = selectSourceTrack(tracks)
    if (!source)
      return []

    this.sourceLanguage = source.language ?? ""

    return this.cache(await this.site.fetchTrack(source))
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    return !!this.site.startLiveCapture || selectSourceTrack(await this.site.discoverTracks()) !== null
  }

  shouldUseSameTrack(): Promise<boolean> {
    return Promise.resolve(this.subtitles.length > 0 && this.cachedPagePath === window.location.pathname)
  }

  cleanup(): void {
    this.sourceLanguage = ""
    this.subtitles = []
    this.cachedPagePath = null
    this.site.cleanup?.()
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  startLiveCapture(onFragments: (fragments: SubtitlesFragment[]) => void): (() => void) | void {
    return this.site.startLiveCapture?.(onFragments)
  }

  private cache(subtitles: SubtitlesFragment[]): SubtitlesFragment[] {
    this.subtitles = subtitles
    this.cachedPagePath = window.location.pathname
    return subtitles
  }
}
