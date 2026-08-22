import type { SubtitlesFetcher } from "../types"
import type { XcomSubtitleRendition, XcomTextTrackSnapshot } from "./hls"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import {
  XCOM_FETCH_TIMEOUT_MS,
  XCOM_HLS_DISCOVERY_POLL_INTERVAL_MS,
  XCOM_HLS_DISCOVERY_TIMEOUT_MS,
  XCOM_SEGMENT_FETCH_CONCURRENCY,
  XCOM_TRACK_DISCOVERY_CACHE_TTL_MS,
} from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { OverlaySubtitlesError } from "@/utils/subtitles/errors"
import { getXcomStatusId } from "@/utils/subtitles/video-id"
import { getCurrentXcomSubtitlesVideo } from "./dom"
import { orderSubtitleRenditions, parseSubtitleRenditions, resolveSubtitleSegmentUrls } from "./hls"
import { getWebVttTimestampMapOffsetMs, parseWebVttSubtitles } from "./webvtt"

const HLS_EXTENSION_PATTERN = /\.m3u8(?:[?#]|$)/i
const WEBVTT_EXTENSION_PATTERN = /\.vtt(?:[?#]|$)/i
const XCOM_VIDEO_RESOURCE_ID_PATTERN = /\/(?:amplify_video|ext_tw_video|tweet_video)\/(\d+)\//i

interface DiscoveredXcomSubtitleTrack extends XcomSubtitleRendition {
  statusId: string
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function isSubtitleResourceUrl(value: string): boolean {
  return (
    isHttpUrl(value) && (HLS_EXTENSION_PATTERN.test(value) || WEBVTT_EXTENSION_PATTERN.test(value))
  )
}

function isXcomVideoResourceUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value)
    return hostname === "video.twimg.com" || hostname.endsWith(".video.twimg.com")
  } catch {
    return false
  }
}

function getXcomVideoResourceId(value: string): string | null {
  if (!isXcomVideoResourceUrl(value)) {
    return null
  }

  try {
    return new URL(value).pathname.match(XCOM_VIDEO_RESOURCE_ID_PATTERN)?.[1] ?? null
  } catch {
    return null
  }
}

function getVideoResourceIds(video: HTMLVideoElement): Set<string> {
  return new Set(
    [
      video.currentSrc,
      video.src,
      ...Array.from(video.querySelectorAll<HTMLSourceElement>("source")).map(
        (source) => source.src,
      ),
    ]
      .flatMap((source) => (source ? [getXcomVideoResourceId(source)] : []))
      .filter((id): id is string => !!id),
  )
}

function getTextTrackSnapshot(track: TextTrack): XcomTextTrackSnapshot {
  return { label: track.label, language: track.language, mode: track.mode }
}

function getSelectedTextTrackSnapshot(video: HTMLVideoElement): XcomTextTrackSnapshot | null {
  const tracks = Array.from(video.textTracks ?? [])
  const selected =
    tracks.find((track) => track.mode === "showing") ??
    tracks.find((track) => track.mode === "hidden")

  return selected ? getTextTrackSnapshot(selected) : null
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length })
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      const item = items[index]
      if (item === undefined) {
        continue
      }
      results[index] = await mapper(item, index)
    }
  })

  await Promise.all(workers)
  return results
}

export class XcomSubtitlesFetcher implements SubtitlesFetcher {
  private subtitles: SubtitlesFragment[] = []
  private sourceLanguage = ""
  private cachedTrackHash: string | null = null
  private discoveryCache: {
    statusId: string
    at: number
    tracks: DiscoveredXcomSubtitleTrack[]
  } | null = null
  private hiddenNativeTrackModes = new Map<TextTrack, TextTrackMode>()

  async fetch(): Promise<SubtitlesFragment[]> {
    const statusId = getXcomStatusId()
    if (!statusId) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.videoNotFound"))
    }

    const currentHash = await this.computeTrackHash()
    if (currentHash && this.subtitles.length > 0 && this.cachedTrackHash === currentHash) {
      return this.subtitles
    }

    const tracks = await this.discoverHlsTracks(statusId)
    const result = await this.fetchFirstHlsTrack(
      tracks.length > 0 ? tracks : await this.waitForHlsTracks(statusId),
    )

    if (!result) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
    }

    this.sourceLanguage = result.language
    this.subtitles = result.fragments
    this.cachedTrackHash = result.trackHash

    return this.subtitles
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    const statusId = getXcomStatusId()
    if (!statusId) {
      return false
    }

    try {
      if ((await this.discoverHlsTracks(statusId)).length > 0) {
        return true
      }

      return (await this.waitForHlsTracks(statusId)).length > 0
    } catch {
      return false
    }
  }

  async shouldUseSameTrack(): Promise<boolean> {
    if (this.subtitles.length === 0 || !this.cachedTrackHash) {
      return false
    }

    try {
      const currentHash = await this.computeTrackHash()
      return currentHash !== null && currentHash === this.cachedTrackHash
    } catch {
      return false
    }
  }

  hideNativeSubtitles(): void {
    const video = getCurrentXcomSubtitlesVideo()
    if (!video) {
      return
    }

    for (const track of Array.from(video.textTracks ?? [])) {
      if (track.mode === "disabled" || this.hiddenNativeTrackModes.has(track)) {
        continue
      }

      this.hiddenNativeTrackModes.set(track, track.mode)
      track.mode = "disabled"
    }
  }

  showNativeSubtitles(): void {
    for (const [track, mode] of this.hiddenNativeTrackModes) {
      try {
        track.mode = mode
      } catch {
        continue
      }
    }

    this.hiddenNativeTrackModes.clear()
  }

  cleanup(): void {
    this.showNativeSubtitles()
    this.subtitles = []
    this.sourceLanguage = ""
    this.cachedTrackHash = null
    this.discoveryCache = null
  }

  private async computeTrackHash(): Promise<string | null> {
    const statusId = getXcomStatusId()
    if (!statusId) {
      return null
    }

    const [track] = await this.discoverHlsTracks(statusId)
    return track ? this.buildTrackHash(track) : null
  }

  private buildTrackHash(track: DiscoveredXcomSubtitleTrack): string {
    return [track.statusId, track.language, track.name, track.groupId, track.uri].join(":")
  }

  private async discoverHlsTracks(statusId: string): Promise<DiscoveredXcomSubtitleTrack[]> {
    const cache = this.discoveryCache
    if (cache?.statusId === statusId && Date.now() - cache.at < XCOM_TRACK_DISCOVERY_CACHE_TTL_MS) {
      return cache.tracks
    }

    const video = getCurrentXcomSubtitlesVideo()
    if (!video) {
      return []
    }

    const selectedTextTrack = getSelectedTextTrackSnapshot(video)
    const tracks: DiscoveredXcomSubtitleTrack[] = []

    for (const manifestUrl of this.getCandidateManifestUrls(video)) {
      let manifestText: string

      try {
        manifestText = await this.fetchText(manifestUrl)
      } catch {
        continue
      }

      const renditions = parseSubtitleRenditions(manifestUrl, manifestText)
      if (renditions.length > 0) {
        tracks.push(
          ...orderSubtitleRenditions(renditions, selectedTextTrack).map((rendition) => ({
            ...rendition,
            statusId,
          })),
        )
      }
    }

    this.discoveryCache = { statusId, at: Date.now(), tracks }
    return tracks
  }

  private async waitForHlsTracks(statusId: string): Promise<DiscoveredXcomSubtitleTrack[]> {
    const deadline = Date.now() + XCOM_HLS_DISCOVERY_TIMEOUT_MS

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, XCOM_HLS_DISCOVERY_POLL_INTERVAL_MS))

      try {
        const tracks = await this.discoverHlsTracks(statusId)
        if (tracks.length > 0) {
          return tracks
        }
      } catch {
        continue
      }
    }

    return []
  }

  private getCandidateManifestUrls(video: HTMLVideoElement): string[] {
    const videoResourceIds = getVideoResourceIds(video)

    const directUrls = [
      video.currentSrc,
      video.src,
      ...Array.from(video.querySelectorAll<HTMLSourceElement>("source")).map(
        (source) => source.src,
      ),
    ].filter((url): url is string => !!url && isSubtitleResourceUrl(url))

    const timedUrls = performance
      .getEntriesByType("resource")
      .filter((entry): entry is PerformanceResourceTiming => {
        if (entry.entryType !== "resource") {
          return false
        }

        const url = entry.name
        if (
          !isSubtitleResourceUrl(url) ||
          !isXcomVideoResourceUrl(url) ||
          videoResourceIds.size === 0
        ) {
          return false
        }

        const resourceId = getXcomVideoResourceId(url)
        return !!resourceId && videoResourceIds.has(resourceId)
      })
      .sort((a, b) => b.startTime - a.startTime)
      .map((entry) => entry.name)

    return [...new Set([...directUrls, ...timedUrls])]
  }

  private async fetchTrackFragments(
    track: DiscoveredXcomSubtitleTrack,
  ): Promise<SubtitlesFragment[]> {
    const playlistText = await this.fetchText(track.uri)

    if (WEBVTT_EXTENSION_PATTERN.test(track.uri) || playlistText.trimStart().startsWith("WEBVTT")) {
      return parseWebVttSubtitles(playlistText)
    }

    const segmentUrls = resolveSubtitleSegmentUrls(track.uri, playlistText)
    if (segmentUrls.length === 0) {
      return []
    }

    const segments = await mapWithConcurrency(
      segmentUrls,
      XCOM_SEGMENT_FETCH_CONCURRENCY,
      async (segmentUrl) => {
        try {
          return await this.fetchText(segmentUrl)
        } catch {
          return null
        }
      },
    )

    return this.mergeSegmentFragments(segments)
  }

  private mergeSegmentFragments(segments: (string | null)[]): SubtitlesFragment[] {
    let baselineOffset: number | null = null
    const fragments: SubtitlesFragment[] = []

    for (const segmentText of segments) {
      if (segmentText === null) {
        continue
      }

      const parsed = parseWebVttSubtitles(segmentText)
      if (parsed.length === 0) {
        continue
      }

      const offset = getWebVttTimestampMapOffsetMs(segmentText)
      if (offset === null) {
        fragments.push(...parsed)
        continue
      }

      baselineOffset ??= offset
      const shift = offset - baselineOffset

      fragments.push(
        ...parsed.map((fragment) => ({
          ...fragment,
          start: fragment.start + shift,
          end: fragment.end + shift,
        })),
      )
    }

    return fragments.sort((a, b) => a.start - b.start || a.end - b.end)
  }

  private async fetchFirstHlsTrack(
    tracks: DiscoveredXcomSubtitleTrack[],
  ): Promise<{ fragments: SubtitlesFragment[]; language: string; trackHash: string } | null> {
    for (const track of tracks) {
      let fragments: SubtitlesFragment[]

      try {
        fragments = await this.fetchTrackFragments(track)
      } catch {
        continue
      }

      if (fragments.length === 0) {
        continue
      }

      return { fragments, language: track.language, trackHash: this.buildTrackHash(track) }
    }

    return null
  }

  private async fetchText(url: string): Promise<string> {
    const response = await fetch(url, { signal: AbortSignal.timeout(XCOM_FETCH_TIMEOUT_MS) })
    if (!response.ok) {
      throw new Error(`Failed to fetch x.com subtitles (${response.status})`)
    }

    return response.text()
  }
}
