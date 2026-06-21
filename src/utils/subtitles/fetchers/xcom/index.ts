import type { SubtitlesFetcher } from "../types"
import type { XcomSubtitleRendition, XcomTextTrackSnapshot } from "./hls"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { i18n } from "#imports"
import { OverlaySubtitlesError } from "@/utils/subtitles/errors"
import { getXcomStatusId } from "@/utils/subtitles/video-id"
import { getCurrentXcomSubtitlesVideo } from "./dom"
import { orderSubtitleRenditions, parseSubtitleRenditions, resolveSubtitleSegmentUrls } from "./hls"
import { cleanWebVttCueText, parseWebVttSubtitles } from "./webvtt"

const HLS_EXTENSION_PATTERN = /\.m3u8(?:[?#]|$)/i
const WEBVTT_EXTENSION_PATTERN = /\.vtt(?:[?#]|$)/i
const XCOM_DIRECT_SUBTITLE_PLAYLIST_PATH_PATTERN = /\/pl\/s\d+\//i
const XCOM_SUBTITLE_RESOURCE_PATH_PATTERN = /\/subtitles\//i
const XCOM_VIDEO_RESOURCE_ID_PATTERN = /\/(?:amplify_video|ext_tw_video|tweet_video)\/(\d+)\//i
const HLS_TRACK_DISCOVERY_TIMEOUT_MS = 5000
const HLS_TRACK_DISCOVERY_POLL_INTERVAL_MS = 500
const TEXT_TRACK_CUE_LOAD_TIMEOUT_MS = 8000
const TEXT_TRACK_CUE_POLL_INTERVAL_MS = 100

interface DiscoveredXcomSubtitleTrack extends XcomSubtitleRendition {
  statusId: string
}

interface TextTrackSubtitlesResult {
  fragments: SubtitlesFragment[]
  language: string
  trackHash: string
}

interface HlsSubtitlesResult {
  fragments: SubtitlesFragment[]
  language: string
  trackHash: string
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  }
  catch {
    return false
  }
}

function isHlsUrl(value: string): boolean {
  return isHttpUrl(value) && HLS_EXTENSION_PATTERN.test(value)
}

function isWebVttUrl(value: string): boolean {
  return isHttpUrl(value) && WEBVTT_EXTENSION_PATTERN.test(value)
}

function isWebVttText(text: string): boolean {
  return text.trimStart().startsWith("WEBVTT")
}

function isXcomVideoResourceUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.hostname === "video.twimg.com" || url.hostname.endsWith(".video.twimg.com")
  }
  catch {
    return false
  }
}

function getXcomVideoResourceId(value: string): string | null {
  try {
    const url = new URL(value)
    if (!isXcomVideoResourceUrl(value)) {
      return null
    }

    return url.pathname.match(XCOM_VIDEO_RESOURCE_ID_PATTERN)?.[1] ?? null
  }
  catch {
    return null
  }
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls)]
}

function getVideoResourceIds(video: HTMLVideoElement): Set<string> {
  return new Set(
    [
      video.currentSrc,
      video.src,
      ...Array.from(video.querySelectorAll<HTMLSourceElement>("source"))
        .map(source => source.src),
    ]
      .map(source => source ? getXcomVideoResourceId(source) : null)
      .filter((id): id is string => !!id),
  )
}

function getTextTrackSnapshot(track: TextTrack): XcomTextTrackSnapshot {
  return {
    label: track.label,
    language: track.language,
    mode: track.mode,
  }
}

function getSelectedTextTrack(
  video: HTMLVideoElement,
  preferredTrack: TextTrack | null = null,
): TextTrack | null {
  const tracks = Array.from(video.textTracks ?? [])
  return (preferredTrack && tracks.includes(preferredTrack) ? preferredTrack : null)
    ?? tracks.find(track => track.mode === "showing")
    ?? tracks.find(track => track.mode === "hidden")
    ?? null
}

function getSelectedTextTrackSnapshot(
  video: HTMLVideoElement,
  preferredTrack: TextTrack | null = null,
): XcomTextTrackSnapshot | null {
  const selectedTrack = getSelectedTextTrack(video, preferredTrack)
  if (!selectedTrack) {
    return null
  }

  return getTextTrackSnapshot(selectedTrack)
}

function getTextTrackHint(
  video: HTMLVideoElement,
  preferredTrack: TextTrack | null = null,
): XcomTextTrackSnapshot | null {
  const selectedTrack = getSelectedTextTrackSnapshot(video, preferredTrack)
  if (selectedTrack) {
    return selectedTrack
  }

  const track = Array.from(video.textTracks ?? [])
    .find(track => !!track.language || !!track.label)

  return track ? getTextTrackSnapshot(track) : null
}

function isLikelyDirectSubtitleSourceUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (!isXcomVideoResourceUrl(value)) {
      return false
    }

    return isWebVttUrl(value)
      || XCOM_DIRECT_SUBTITLE_PLAYLIST_PATH_PATTERN.test(url.pathname)
      || (WEBVTT_EXTENSION_PATTERN.test(url.pathname) && XCOM_SUBTITLE_RESOURCE_PATH_PATTERN.test(url.pathname))
  }
  catch {
    return false
  }
}

function buildDirectSubtitleTrack(
  statusId: string,
  uri: string,
  textTrackHint: XcomTextTrackSnapshot | null,
): DiscoveredXcomSubtitleTrack {
  return {
    autoselect: true,
    default: false,
    groupId: "direct",
    language: textTrackHint?.language ?? "",
    name: textTrackHint?.label || "x.com subtitles",
    statusId,
    uri,
  }
}

async function waitForTextTrackCues(track: TextTrack): Promise<TextTrackCueList | null> {
  if (track.cues && track.cues.length > 0) {
    return track.cues
  }

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>
    let intervalId: ReturnType<typeof setInterval>
    let settled = false

    function getLoadedCues() {
      return track.cues && track.cues.length > 0 ? track.cues : null
    }

    function handleCueChange() {
      checkCues()
    }

    function finish(cues: TextTrackCueList | null) {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeoutId)
      clearInterval(intervalId)
      track.removeEventListener("cuechange", handleCueChange)
      resolve(cues)
    }

    function checkCues() {
      const cues = getLoadedCues()
      if (cues) {
        finish(cues)
      }
    }

    timeoutId = setTimeout(() => {
      finish(track.cues)
    }, TEXT_TRACK_CUE_LOAD_TIMEOUT_MS)
    intervalId = setInterval(checkCues, TEXT_TRACK_CUE_POLL_INTERVAL_MS)

    track.addEventListener("cuechange", handleCueChange)
    checkCues()
  })
}

function readCues(cues: TextTrackCueList): SubtitlesFragment[] {
  return Array.from(cues)
    .map((cue) => {
      const text = "text" in cue ? cleanWebVttCueText(String(cue.text)) : ""
      return {
        text,
        start: Math.round(cue.startTime * 1000),
        end: Math.round(cue.endTime * 1000),
      }
    })
    .filter(fragment => fragment.text && fragment.end > fragment.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
}

export class XcomSubtitlesFetcher implements SubtitlesFetcher {
  private subtitles: SubtitlesFragment[] = []
  private sourceLanguage = ""
  private cachedTrackHash: string | null = null
  private hiddenNativeTrackModes = new Map<TextTrack, { mode: TextTrackMode, video: HTMLVideoElement }>()
  private selectedNativeTrackByVideo = new Map<HTMLVideoElement, TextTrack>()

  async fetch(): Promise<SubtitlesFragment[]> {
    const statusId = getXcomStatusId()
    if (!statusId) {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.videoNotFound"))
    }

    const currentHash = await this.computeTrackHash()
    if (currentHash && this.subtitles.length > 0 && this.cachedTrackHash === currentHash) {
      return this.subtitles
    }

    const hlsResult = await this.fetchFirstHlsTrack(await this.discoverHlsTracks(statusId))
    if (hlsResult) {
      this.sourceLanguage = hlsResult.language
      this.subtitles = hlsResult.fragments
      this.cachedTrackHash = hlsResult.trackHash
      return this.subtitles
    }

    const textTrackResult = await this.fetchTextTrackFragments(statusId)
    if (textTrackResult) {
      this.sourceLanguage = textTrackResult.language
      this.subtitles = textTrackResult.fragments
      this.cachedTrackHash = textTrackResult.trackHash
      return this.subtitles
    }

    const delayedHlsResult = await this.fetchFirstHlsTrack(await this.waitForHlsTracks(statusId))
    if (delayedHlsResult) {
      this.sourceLanguage = delayedHlsResult.language
      this.subtitles = delayedHlsResult.fragments
      this.cachedTrackHash = delayedHlsResult.trackHash
      return this.subtitles
    }

    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  cleanup(): void {
    this.subtitles = []
    this.sourceLanguage = ""
    this.cachedTrackHash = null
  }

  hideNativeSubtitles(): void {
    const video = getCurrentXcomSubtitlesVideo()
    if (!video) {
      return
    }

    const tracks = Array.from(video.textTracks ?? [])
    const showingTrack = tracks.find(track => track.mode === "showing")
    if (showingTrack) {
      this.selectedNativeTrackByVideo.set(video, showingTrack)
    }

    tracks
      .filter(track => track.mode === "showing")
      .forEach((track) => {
        if (!this.hiddenNativeTrackModes.has(track)) {
          this.hiddenNativeTrackModes.set(track, { mode: track.mode, video })
        }
        track.mode = "hidden"
      })
  }

  showNativeSubtitles(): void {
    this.hiddenNativeTrackModes.forEach(({ mode, video }, track) => {
      const hasCurrentShowingTrack = Array.from(video.textTracks ?? [])
        .some(candidate => candidate.mode === "showing")
      const selectedTrack = this.selectedNativeTrackByVideo.get(video)
      if (track.mode === "hidden" && !hasCurrentShowingTrack && selectedTrack === track) {
        track.mode = mode
      }
    })
    this.hiddenNativeTrackModes.clear()
    this.selectedNativeTrackByVideo.clear()
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    const statusId = getXcomStatusId()
    if (!statusId) {
      return false
    }

    const video = getCurrentXcomSubtitlesVideo()
    if (video && video.textTracks.length > 0) {
      return true
    }

    try {
      if ((await this.discoverHlsTracks(statusId)).length > 0) {
        return true
      }

      return (await this.waitForHlsTracks(statusId)).length > 0
    }
    catch {
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
    }
    catch {
      return false
    }
  }

  private async computeTrackHash(): Promise<string | null> {
    const statusId = getXcomStatusId()
    if (!statusId) {
      return null
    }

    const [hlsTrack] = await this.discoverHlsTracks(statusId)
    if (hlsTrack) {
      return this.buildHlsTrackHash(hlsTrack)
    }

    const video = getCurrentXcomSubtitlesVideo()
    const textTrack = video ? this.getSelectedTextTrackSnapshot(video) : null
    return textTrack
      ? this.buildTextTrackHash(statusId, textTrack)
      : null
  }

  private buildHlsTrackHash(track: DiscoveredXcomSubtitleTrack): string {
    return [
      track.statusId,
      track.language,
      track.name,
      track.groupId,
      track.uri,
    ].join(":")
  }

  private buildTextTrackHash(statusId: string, track: XcomTextTrackSnapshot): string {
    return [
      statusId,
      track.language,
      track.label,
      "text-track",
    ].join(":")
  }

  private async discoverHlsTracks(statusId: string): Promise<DiscoveredXcomSubtitleTrack[]> {
    const video = getCurrentXcomSubtitlesVideo()
    if (!video) {
      return []
    }

    const tracks: DiscoveredXcomSubtitleTrack[] = []
    const selectedTextTrack = this.getSelectedTextTrackSnapshot(video)
    const textTrackHint = this.getTextTrackHint(video)
    const manifestUrls = this.getCandidateManifestUrls(video)

    for (const manifestUrl of manifestUrls) {
      let manifestText: string

      try {
        manifestText = await this.fetchText(manifestUrl)
      }
      catch {
        continue
      }

      const renditions = parseSubtitleRenditions(manifestUrl, manifestText)

      if (renditions.length > 0) {
        tracks.push(...orderSubtitleRenditions(renditions, selectedTextTrack)
          .map(rendition => ({ ...rendition, statusId })),
        )
        continue
      }

      if (isLikelyDirectSubtitleSourceUrl(manifestUrl)
        && (isWebVttText(manifestText) || resolveSubtitleSegmentUrls(manifestUrl, manifestText).length > 0)) {
        tracks.push(buildDirectSubtitleTrack(statusId, manifestUrl, textTrackHint))
      }
    }

    return tracks
  }

  private async waitForHlsTracks(statusId: string): Promise<DiscoveredXcomSubtitleTrack[]> {
    return new Promise((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout>
      let intervalId: ReturnType<typeof setInterval>
      let checking = false
      let settled = false

      const finish = (tracks: DiscoveredXcomSubtitleTrack[]) => {
        if (settled) {
          return
        }

        settled = true
        clearTimeout(timeoutId)
        clearInterval(intervalId)
        resolve(tracks)
      }

      const check = async () => {
        if (checking) {
          return
        }

        checking = true
        try {
          const tracks = await this.discoverHlsTracks(statusId)
          if (tracks.length > 0) {
            finish(tracks)
          }
        }
        catch {
          // Keep polling until the bounded discovery window expires.
        }
        finally {
          checking = false
        }
      }

      timeoutId = setTimeout(() => {
        finish([])
      }, HLS_TRACK_DISCOVERY_TIMEOUT_MS)
      intervalId = setInterval(() => {
        void check()
      }, HLS_TRACK_DISCOVERY_POLL_INTERVAL_MS)

      void check()
    })
  }

  private getCandidateManifestUrls(video: HTMLVideoElement): string[] {
    const videoResourceIds = getVideoResourceIds(video)
    const directUrls = [
      video.currentSrc,
      video.src,
      ...Array.from(video.querySelectorAll<HTMLSourceElement>("source"))
        .map(source => source.src),
    ].filter((url): url is string => !!url && (isHlsUrl(url) || isWebVttUrl(url)))

    const performanceUrls = performance
      .getEntriesByType("resource")
      .filter((entry): entry is PerformanceResourceTiming => entry.entryType === "resource")
      .sort((a, b) => b.startTime - a.startTime)
      .map(entry => entry.name)
      .filter((url) => {
        if (!(isHlsUrl(url) || isWebVttUrl(url)) || !isXcomVideoResourceUrl(url)) {
          return false
        }

        if (videoResourceIds.size === 0) {
          return false
        }

        const resourceId = getXcomVideoResourceId(url)
        return !!resourceId && videoResourceIds.has(resourceId)
      })

    return dedupeUrls([
      ...directUrls,
      ...performanceUrls,
    ])
  }

  private async fetchTrackFragments(track: DiscoveredXcomSubtitleTrack): Promise<SubtitlesFragment[]> {
    const playlistText = await this.fetchText(track.uri)

    if (isWebVttText(playlistText) || WEBVTT_EXTENSION_PATTERN.test(track.uri)) {
      return parseWebVttSubtitles(playlistText)
    }

    const segmentUrls = resolveSubtitleSegmentUrls(track.uri, playlistText)
    const fragments: SubtitlesFragment[] = []

    for (const segmentUrl of segmentUrls) {
      const segmentText = await this.fetchText(segmentUrl)
      fragments.push(...parseWebVttSubtitles(segmentText))
    }

    return fragments.sort((a, b) => a.start - b.start || a.end - b.end)
  }

  private async fetchFirstHlsTrack(tracks: DiscoveredXcomSubtitleTrack[]): Promise<HlsSubtitlesResult | null> {
    for (const track of tracks) {
      let fragments: SubtitlesFragment[]

      try {
        fragments = await this.fetchTrackFragments(track)
      }
      catch {
        continue
      }

      if (fragments.length === 0) {
        continue
      }

      return {
        fragments,
        language: track.language,
        trackHash: this.buildHlsTrackHash(track),
      }
    }

    return null
  }

  private async fetchTextTrackFragments(statusId: string): Promise<TextTrackSubtitlesResult | null> {
    const video = getCurrentXcomSubtitlesVideo()
    if (!video) {
      return null
    }

    const tracks = Array.from(video.textTracks ?? [])
    const preferredTrack = this.getPreferredNativeTextTrack(video)
    const orderedTracks = [
      ...(preferredTrack ? [preferredTrack] : []),
      ...tracks.filter(track => track.mode === "showing"),
      ...tracks.filter(track => track.mode === "hidden"),
      ...tracks.filter(track => track.mode === "disabled"),
    ].filter((track, index, allTracks) => allTracks.indexOf(track) === index)

    for (const track of orderedTracks) {
      const originalMode = track.mode
      if (track.mode === "disabled") {
        track.mode = "hidden"
      }

      const cues = await waitForTextTrackCues(track)
      if (originalMode === "disabled") {
        track.mode = originalMode
      }

      if (!cues || cues.length === 0) {
        continue
      }

      const fragments = readCues(cues)
      if (fragments.length === 0) {
        continue
      }

      const snapshot: XcomTextTrackSnapshot = {
        label: track.label,
        language: track.language,
        mode: track.mode,
      }

      return {
        fragments,
        language: track.language,
        trackHash: this.buildTextTrackHash(statusId, snapshot),
      }
    }

    return null
  }

  private async fetchText(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch x.com subtitles (${response.status})`)
    }

    return response.text()
  }

  private getPreferredNativeTextTrack(video: HTMLVideoElement): TextTrack | null {
    const track = this.selectedNativeTrackByVideo.get(video) ?? null
    if (!track) {
      return null
    }

    const tracks = Array.from(video.textTracks ?? [])
    const currentShowingTrack = tracks.find(candidate => candidate.mode === "showing")
    if (currentShowingTrack) {
      return null
    }

    if (!tracks.includes(track) || !this.hiddenNativeTrackModes.has(track) || track.mode !== "hidden") {
      return null
    }

    return track
  }

  private getSelectedTextTrackSnapshot(video: HTMLVideoElement): XcomTextTrackSnapshot | null {
    return getSelectedTextTrackSnapshot(video, this.getPreferredNativeTextTrack(video))
  }

  private getTextTrackHint(video: HTMLVideoElement): XcomTextTrackSnapshot | null {
    return getTextTrackHint(video, this.getPreferredNativeTextTrack(video))
  }
}
