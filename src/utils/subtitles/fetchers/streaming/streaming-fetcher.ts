import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { SubtitlesFetcher } from "../types"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { getLocalConfig } from "@/utils/config/storage"
import { resolveLanguageCodeFromLocale } from "@/utils/content/page-language"
import { alignOfficialSubtitles } from "./cue-parser"

export interface StreamingTrack {
  id?: string
  url?: string
  urls?: string[]
  segmentStartMs?: number[]
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

export function selectTargetTrack(tracks: StreamingTrack[], targetCode: LangCodeISO6393): StreamingTrack | null {
  const candidates = tracks.map(track => ({
    track,
    resolved: resolveLanguageCodeFromLocale(track.language ?? track.label ?? ""),
  }))
  const exactMatch = candidates.find(({ resolved }) => resolved === targetCode)
  if (exactMatch)
    return exactMatch.track

  if (!isChineseCode(targetCode))
    return null

  return candidates.find(({ track, resolved }) =>
    !resolved && /zh|中文|Chinese/i.test(`${track.language ?? ""} ${track.label ?? ""}`),
  )?.track ?? null
}

function isChineseCode(code: LangCodeISO6393): boolean {
  return code === "cmn" || code === "cmn-Hant" || code === "yue"
}

function trackKey(track: StreamingTrack): string {
  return track.id ?? track.url ?? track.urls?.join("\n") ?? track.label ?? track.language ?? ""
}

export class StreamingSubtitlesFetcher implements SubtitlesFetcher {
  private readonly site: StreamingSiteAdapter
  private sourceLanguage = ""
  private subtitles: SubtitlesFragment[] = []
  private cachedPagePath: string | null = null
  private bilingual = false

  constructor(site: StreamingSiteAdapter) {
    this.site = site
  }

  async fetch(): Promise<SubtitlesFragment[]> {
    this.subtitles = []
    this.cachedPagePath = null
    this.bilingual = false

    const tracks = await this.site.discoverTracks()
    const source = selectSourceTrack(tracks)
    if (!source)
      return []

    this.sourceLanguage = source.language ?? ""

    const config = await getLocalConfig()
    const targetCode = config?.language.targetCode ?? null
    const target = targetCode ? selectTargetTrack(tracks, targetCode) : null

    if (target && trackKey(target) !== trackKey(source)) {
      const [sourceFragments, targetFragments] = await Promise.all([
        this.site.fetchTrack(source),
        this.site.fetchTrack(target),
      ])
      const aligned = alignOfficialSubtitles(sourceFragments, targetFragments)
      if (aligned.length > 0)
        return this.cache(aligned, true)
      return this.cache(sourceFragments, false)
    }

    return this.cache(await this.site.fetchTrack(source), false)
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    return selectSourceTrack(await this.site.discoverTracks()) !== null
  }

  shouldUseSameTrack(): Promise<boolean> {
    return Promise.resolve(this.subtitles.length > 0 && this.cachedPagePath === window.location.pathname)
  }

  cleanup(): void {
    this.sourceLanguage = ""
    this.subtitles = []
    this.cachedPagePath = null
    this.bilingual = false
    this.site.cleanup?.()
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  isPreSegmented(): boolean {
    return this.bilingual
  }

  startLiveCapture(onFragments: (fragments: SubtitlesFragment[]) => void): (() => void) | void {
    return this.site.startLiveCapture?.(onFragments)
  }

  private cache(subtitles: SubtitlesFragment[], bilingual: boolean): SubtitlesFragment[] {
    this.subtitles = subtitles
    this.bilingual = bilingual
    this.cachedPagePath = window.location.pathname
    return subtitles
  }
}
