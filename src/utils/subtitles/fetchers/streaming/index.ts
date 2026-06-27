import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { SubtitlesFragment } from "../../types"
import type { SubtitlesFetcher } from "../types"
import type { StreamingSubtitleCapture, StreamingSubtitleTrack } from "./captured-subtitles"
import { i18n } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import {
  STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE,
  STREAMING_NATIVE_SUBTITLES_SELECTOR,
  STREAMING_OFFICIAL_SUBTITLE_TRACK_WAIT_TIMEOUT_MS,
  STREAMING_SUBTITLE_WAIT_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
import { backgroundFetch } from "@/utils/content-script/background-fetch-client"
import { resolveLanguageCodeFromLocale } from "@/utils/content/page-language"
import { OverlaySubtitlesError } from "@/utils/subtitles/errors"
import {
  ensureStreamingSubtitleCaptureListener,
  getStreamingSubtitleCapture,
  getStreamingSubtitleTracks,
  waitForStreamingSubtitleCandidate,
  waitForStreamingSubtitleCapture,
  waitForStreamingSubtitleTracks,
} from "./captured-subtitles"
import { parseStreamingSubtitles } from "./parser"

type StreamingSubtitleSource = StreamingSubtitleTrack | StreamingSubtitleCapture
type LiveSubtitlesSubscriber = (subtitles: SubtitlesFragment[]) => void

const NATIVE_SUBTITLE_LEAD_IN_MS = 300
const NATIVE_SUBTITLE_TRAILING_MS = 6_000
const NATIVE_SUBTITLE_BLANK_GRACE_MS = 500

function isTrack(source: StreamingSubtitleSource): source is StreamingSubtitleTrack {
  return !("text" in source)
}

function resolveTrackLanguage(track: StreamingSubtitleTrack): LangCodeISO6393 | null {
  return resolveLanguageCodeFromLocale(track.language ?? track.label)
}

function getTrackLanguageText(track: StreamingSubtitleTrack): string {
  return `${track.language ?? ""} ${track.label ?? ""}`.toLowerCase()
}

function isEnglishTrack(track: StreamingSubtitleTrack): boolean {
  return resolveTrackLanguage(track) === "eng" || /\benglish\b|\ben\b/.test(getTrackLanguageText(track))
}

function isChineseTrack(track: StreamingSubtitleTrack): boolean {
  return isChineseCode(resolveTrackLanguage(track)) || /zh|chinese|中文|简体|簡體|繁体|繁體|普通话|國語/.test(getTrackLanguageText(track))
}

function isChineseCode(code: LangCodeISO6393 | null | undefined): boolean {
  return code === "cmn" || code === "cmn-Hant" || code === "yue"
}

function getTrackRoleText(track: StreamingSubtitleTrack): string {
  return `${track.kind ?? ""} ${track.label ?? ""}`.toLowerCase()
}

function isCaptionLikeTrack(track: StreamingSubtitleTrack): boolean {
  return /assistive|caption|closed\s*caption|subtitle|\bcc\b|字幕|情境字幕/.test(getTrackRoleText(track))
}

function isLikelyOriginalAudioTrack(track: StreamingSubtitleTrack): boolean {
  const roleText = getTrackRoleText(track)
  return /original|原始/.test(roleText) && /primary|audio/.test(roleText)
}

export function selectStreamingSubtitleTrack(
  tracks: StreamingSubtitleTrack[],
  options: {
    sourceCode?: LangCodeISO6393 | "auto"
    targetCode?: LangCodeISO6393
  } = {},
): StreamingSubtitleTrack | null {
  if (tracks.length === 0)
    return null

  const sourceCode = options.sourceCode && options.sourceCode !== "auto" ? options.sourceCode : null
  const targetCode = options.targetCode ?? null

  return [...tracks]
    .sort((a, b) => scoreTrack(b, sourceCode, targetCode) - scoreTrack(a, sourceCode, targetCode))[0] ?? null
}

function scoreTrack(track: StreamingSubtitleTrack, sourceCode: LangCodeISO6393 | null, targetCode: LangCodeISO6393 | null): number {
  const language = resolveTrackLanguage(track)
  const kind = `${track.kind ?? ""} ${track.label ?? ""}`.toLowerCase()
  let score = 0

  if (sourceCode && language === sourceCode)
    score += 100

  if (targetCode && language === targetCode)
    score -= 50

  if (kind.includes("forced") || kind.includes("narrative"))
    score -= 20

  if (kind.includes("primary") || kind.includes("main"))
    score += 10

  return score
}

function isForcedTrack(track: StreamingSubtitleTrack): boolean {
  const kind = `${track.kind ?? ""} ${track.label ?? ""}`.toLowerCase()
  return kind.includes("forced") || kind.includes("narrative")
}

function isNetflixWatchRouteTrack(track: StreamingSubtitleTrack): boolean {
  try {
    const url = new URL(track.url)
    return /(?:^|\.)netflix\.com$/i.test(url.hostname)
      && /^\/watch\/(?:timedtext|subtitles|closedcaptions)\/?$/i.test(url.pathname)
  }
  catch {
    return false
  }
}

function hasOfficialTrackMetadata(track: StreamingSubtitleTrack): boolean {
  return Boolean(track.language?.trim() && track.label?.trim())
}

function getOfficialTrackCandidates(tracks: StreamingSubtitleTrack[]): StreamingSubtitleTrack[] {
  const usableTracks = tracks.filter(track => !isForcedTrack(track) && !isNetflixWatchRouteTrack(track))
  const tracksWithMetadata = usableTracks.filter(hasOfficialTrackMetadata)
  return tracksWithMetadata.length > 0 ? tracksWithMetadata : usableTracks
}

function selectOfficialSourceTrack(
  tracks: StreamingSubtitleTrack[],
  sourceCode: LangCodeISO6393 | "auto" | undefined,
  targetCode: LangCodeISO6393,
): StreamingSubtitleTrack | null {
  const usableTracks = getOfficialTrackCandidates(tracks)
  if (sourceCode && sourceCode !== "auto") {
    return selectStreamingSubtitleTrack(usableTracks, { sourceCode, targetCode })
  }

  const englishTracks = usableTracks.filter(isEnglishTrack)
  return englishTracks.find(isCaptionLikeTrack)
    ?? englishTracks.find(track => !isLikelyOriginalAudioTrack(track))
    ?? englishTracks[0]
    ?? selectStreamingSubtitleTrack(usableTracks, { targetCode })
}

function selectOfficialTargetTrack(
  tracks: StreamingSubtitleTrack[],
  targetCode: LangCodeISO6393,
): StreamingSubtitleTrack | null {
  return getOfficialTrackCandidates(tracks).find(track =>
    resolveTrackLanguage(track) === targetCode || (isChineseCode(targetCode) && isChineseTrack(track))) ?? null
}

function hasOfficialTrackPair(
  tracks: StreamingSubtitleTrack[],
  sourceCode: LangCodeISO6393 | "auto" | undefined,
  targetCode: LangCodeISO6393,
): boolean {
  const sourceTrack = selectOfficialSourceTrack(tracks, sourceCode, targetCode)
  const targetTrack = selectOfficialTargetTrack(tracks, targetCode)
  return Boolean(sourceTrack && targetTrack && sourceTrack.url !== targetTrack.url)
}

function buildOfficialBilingualSubtitles(
  sourceSubtitles: SubtitlesFragment[],
  targetSubtitles: SubtitlesFragment[],
): SubtitlesFragment[] {
  const sourceByTargetIndex = new Map<number, SubtitlesFragment[]>()
  for (const source of sourceSubtitles) {
    let bestTargetIndex = -1
    let bestOverlap = 0
    for (const [targetIndex, target] of targetSubtitles.entries()) {
      const overlap = getSubtitleOverlapMs(source, target)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        bestTargetIndex = targetIndex
      }
    }

    if (bestTargetIndex >= 0) {
      sourceByTargetIndex.set(bestTargetIndex, [
        ...(sourceByTargetIndex.get(bestTargetIndex) ?? []),
        source,
      ])
    }
  }

  return targetSubtitles
    .map((target, targetIndex): SubtitlesFragment | null => {
      const text = (sourceByTargetIndex.get(targetIndex) ?? [])
        .map(source => source.text)
        .filter((text, index, texts) => text && text !== texts[index - 1])
        .join("\n")

      return text
        ? {
            text,
            translation: target.text,
            start: target.start,
            end: target.end,
          }
        : null
    })
    .filter((fragment): fragment is SubtitlesFragment => fragment !== null)
}

function getSubtitleOverlapMs(a: SubtitlesFragment, b: SubtitlesFragment): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))
}

function attachOfficialTranslations(
  sourceSubtitles: SubtitlesFragment[],
  targetSubtitles: SubtitlesFragment[],
): SubtitlesFragment[] {
  const targetAligned = buildOfficialBilingualSubtitles(sourceSubtitles, targetSubtitles)
  if (targetAligned.length > 0)
    return targetAligned

  return sourceSubtitles.map((source) => {
    const translation = targetSubtitles
      .filter(target => target.start < source.end && target.end > source.start)
      .map(target => target.text)
      .filter((text, index, texts) => text && text !== texts[index - 1])
      .join("\n")

    return translation ? { ...source, translation } : source
  })
}

export class StreamingSubtitlesFetcher implements SubtitlesFetcher {
  private subtitles: SubtitlesFragment[] = []
  private nativeSubtitles: SubtitlesFragment[] = []
  private nativeSubscribers = new Set<LiveSubtitlesSubscriber>()
  private nativeObserver: MutationObserver | null = null
  private nativePollInterval: ReturnType<typeof setInterval> | null = null
  private lastNativeText = ""
  private lastNativeFingerprint = ""
  private lastNativeCapturedAt = -Infinity
  private nativeBlankStartedAt = -Infinity
  private sourceLanguage = ""
  private cachedTrackHash: string | null = null
  private preSegmented = false

  constructor() {
    ensureStreamingSubtitleCaptureListener()
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    ensureStreamingSubtitleCaptureListener()
    this.ensureNativeCapture()

    if (getStreamingSubtitleTracks().length > 0 || getStreamingSubtitleCapture())
      return true

    if (this.nativeSubtitles.length > 0)
      return true

    const [streamingAvailable, nativeAvailable] = await Promise.all([
      waitForStreamingSubtitleCandidate(STREAMING_SUBTITLE_WAIT_TIMEOUT_MS),
      this.waitForNativeSubtitleCandidate(STREAMING_SUBTITLE_WAIT_TIMEOUT_MS),
    ])
    return streamingAvailable || nativeAvailable
  }

  async fetch(): Promise<SubtitlesFragment[]> {
    ensureStreamingSubtitleCaptureListener()
    this.ensureNativeCapture()

    const officialBilingualSubtitles = await this.resolveOfficialBilingualSubtitles()
    if (officialBilingualSubtitles)
      return officialBilingualSubtitles

    this.preSegmented = false
    const source = await this.resolveSource()
    if (!source) {
      const nativeSubtitles = await this.resolveNativeSubtitles()
      if (nativeSubtitles.length === 0)
        throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))

      this.sourceLanguage = "en"
      this.subtitles = nativeSubtitles
      this.cachedTrackHash = "native"
      return nativeSubtitles
    }

    const trackHash = isTrack(source) ? source.url : `${source.url}:${source.text.length}`
    if (this.subtitles.length > 0 && this.cachedTrackHash === trackHash)
      return this.subtitles

    const text = isTrack(source)
      ? await this.resolveTrackText(source)
      : source.text
    const subtitles = parseStreamingSubtitles(text)

    if (subtitles.length === 0)
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.noSubtitlesFound"))

    this.sourceLanguage = source.language ?? ""
    this.subtitles = subtitles
    this.cachedTrackHash = trackHash
    return subtitles
  }

  cleanup(): void {
    this.subtitles = []
    this.nativeSubtitles = []
    this.lastNativeText = ""
    this.lastNativeFingerprint = ""
    this.lastNativeCapturedAt = -Infinity
    this.nativeBlankStartedAt = -Infinity
    this.sourceLanguage = ""
    this.cachedTrackHash = null
    this.preSegmented = false
    this.stopNativeCapture()
  }

  async shouldUseSameTrack(): Promise<boolean> {
    if (this.cachedTrackHash === "native")
      return this.nativeSubtitles.length > 0

    if (!this.cachedTrackHash)
      return false

    const source = await this.resolveSource()
    if (!source)
      return false

    const nextHash = isTrack(source) ? source.url : `${source.url}:${source.text.length}`
    return nextHash === this.cachedTrackHash
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  isPreSegmented(): boolean {
    return this.preSegmented
  }

  watchLiveSubtitles(onSubtitles: LiveSubtitlesSubscriber): () => void {
    this.ensureNativeCapture()
    this.nativeSubscribers.add(onSubtitles)
    const latest = this.nativeSubtitles.at(-1)
    if (latest)
      onSubtitles([latest])

    return () => {
      this.nativeSubscribers.delete(onSubtitles)
    }
  }

  async resolveSource(): Promise<StreamingSubtitleSource | null> {
    const config = await getLocalConfig()

    if (this.nativeSubtitles.length > 0)
      return null

    if (shouldPreferNativeSubtitles() && await this.waitForNativeSubtitleCandidate(STREAMING_SUBTITLE_WAIT_TIMEOUT_MS))
      return null

    const track = selectStreamingSubtitleTrack(getStreamingSubtitleTracks(), {
      sourceCode: config?.language.sourceCode,
      targetCode: config?.language.targetCode,
    })

    if (track)
      return track

    const capture = getStreamingSubtitleCapture()
    if (capture)
      return capture

    if (this.nativeSubtitles.length > 0)
      return null

    const available = await waitForStreamingSubtitleCandidate(STREAMING_SUBTITLE_WAIT_TIMEOUT_MS)
    if (!available)
      return null

    return this.resolveSource()
  }

  private async resolveTrackText(
    track: StreamingSubtitleTrack,
    timeoutMs = STREAMING_SUBTITLE_WAIT_TIMEOUT_MS,
  ): Promise<string> {
    const capture = getStreamingSubtitleCapture(track.url)
    if (capture)
      return capture.text

    try {
      const response = await backgroundFetch(track.url, undefined, { credentials: "include" })
      if (response.ok)
        return await response.text()
    }
    catch {
      // Fall back to the page-world capture below.
    }

    const lateCapture = await waitForStreamingSubtitleCapture(track.url, timeoutMs)
    if (lateCapture)
      return lateCapture.text

    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.fetchSubTimeout"))
  }

  private async resolveOfficialBilingualSubtitles(): Promise<SubtitlesFragment[] | null> {
    const config = await getLocalConfig()
    const targetCode = config?.language.targetCode
    if (!targetCode)
      return null

    let tracks = getStreamingSubtitleTracks()
    if (!hasOfficialTrackPair(tracks, config?.language.sourceCode, targetCode)) {
      tracks = await waitForStreamingSubtitleTracks(
        nextTracks => hasOfficialTrackPair(nextTracks, config?.language.sourceCode, targetCode),
        STREAMING_OFFICIAL_SUBTITLE_TRACK_WAIT_TIMEOUT_MS,
      )
    }

    const sourceTrack = selectOfficialSourceTrack(tracks, config?.language.sourceCode, targetCode)
    const targetTrack = selectOfficialTargetTrack(tracks, targetCode)
    if (!sourceTrack || !targetTrack || sourceTrack.url === targetTrack.url)
      return null

    const trackHash = `${sourceTrack.url}:${targetTrack.url}`
    if (this.subtitles.length > 0 && this.cachedTrackHash === trackHash)
      return this.subtitles

    const subtitles = await this.tryResolveOfficialBilingualSubtitles(sourceTrack, targetTrack)
    if (!subtitles)
      return null

    this.sourceLanguage = sourceTrack.language ?? ""
    this.subtitles = subtitles
    this.cachedTrackHash = trackHash
    this.preSegmented = true
    return subtitles
  }

  private async tryResolveOfficialBilingualSubtitles(
    sourceTrack: StreamingSubtitleTrack,
    targetTrack: StreamingSubtitleTrack,
  ): Promise<SubtitlesFragment[] | null> {
    try {
      const [sourceText, targetText] = await Promise.all([
        this.resolveTrackText(sourceTrack, STREAMING_OFFICIAL_SUBTITLE_TRACK_WAIT_TIMEOUT_MS),
        this.resolveTrackText(targetTrack, STREAMING_OFFICIAL_SUBTITLE_TRACK_WAIT_TIMEOUT_MS),
      ])
      const sourceSubtitles = normalizeOfficialSubtitles(parseStreamingSubtitles(sourceText))
      const targetSubtitles = normalizeOfficialSubtitles(parseStreamingSubtitles(targetText))
      const subtitles = attachOfficialTranslations(sourceSubtitles, targetSubtitles)
      return subtitles.some(subtitle => subtitle.translation) ? subtitles : null
    }
    catch {
      return null
    }
  }

  private async resolveNativeSubtitles(): Promise<SubtitlesFragment[]> {
    this.ensureNativeCapture()

    if (this.nativeSubtitles.length === 0)
      await this.waitForNativeSubtitleCandidate(STREAMING_SUBTITLE_WAIT_TIMEOUT_MS)

    return [...this.nativeSubtitles]
  }

  private ensureNativeCapture() {
    if (this.nativeObserver)
      return

    window.postMessage({ type: STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE }, window.location.origin)

    const root = document.body ?? document.documentElement
    if (!root)
      return

    this.nativeObserver = new MutationObserver(() => this.captureNativeSubtitle())
    this.nativeObserver.observe(root, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    this.nativePollInterval = setInterval(() => this.captureNativeSubtitle(), 500)
    this.captureNativeSubtitle()
  }

  private stopNativeCapture() {
    this.nativeObserver?.disconnect()
    this.nativeObserver = null
    if (this.nativePollInterval) {
      clearInterval(this.nativePollInterval)
      this.nativePollInterval = null
    }
    this.nativeSubscribers.clear()
  }

  private waitForNativeSubtitleCandidate(timeoutMs: number): Promise<boolean> {
    if (this.nativeSubtitles.length > 0)
      return Promise.resolve(true)

    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout>
      const unsubscribe = this.watchLiveSubtitles(() => {
        clearTimeout(timer)
        unsubscribe()
        resolve(true)
      })

      timer = setTimeout(() => {
        unsubscribe()
        resolve(this.nativeSubtitles.length > 0)
      }, timeoutMs)
    })
  }

  private captureNativeSubtitle() {
    const text = readNativeSubtitleText()
    if (!text) {
      this.captureNativeSubtitleBlank()
      return
    }

    const video = document.querySelector<HTMLVideoElement>("video")
    if (!video)
      return

    const nowMs = Math.max(0, Math.round(video.currentTime * 1000))
    this.nativeBlankStartedAt = -Infinity
    const fingerprint = toNativeTextFingerprint(text)
    if (fingerprint === this.lastNativeFingerprint && nowMs - this.lastNativeCapturedAt < 10_000)
      return

    const start = Math.max(0, nowMs - NATIVE_SUBTITLE_LEAD_IN_MS)
    const updatedSubtitles: SubtitlesFragment[] = []
    const previousSubtitle = this.nativeSubtitles.at(-1)
    if (previousSubtitle && previousSubtitle.end > start) {
      previousSubtitle.end = Math.max(previousSubtitle.start + 1, start)
      updatedSubtitles.push(previousSubtitle)
    }

    this.lastNativeText = text
    this.lastNativeFingerprint = fingerprint
    this.lastNativeCapturedAt = nowMs
    const subtitle: SubtitlesFragment = {
      text,
      start,
      end: nowMs + NATIVE_SUBTITLE_TRAILING_MS,
    }

    this.nativeSubtitles.push(subtitle)
    updatedSubtitles.push(subtitle)
    for (const subscriber of this.nativeSubscribers) {
      subscriber(updatedSubtitles)
    }
  }

  private captureNativeSubtitleBlank() {
    const video = document.querySelector<HTMLVideoElement>("video")
    if (!video)
      return

    const previousSubtitle = this.nativeSubtitles.at(-1)
    if (!previousSubtitle)
      return

    const nowMs = Math.max(0, Math.round(video.currentTime * 1000))
    if (previousSubtitle.end <= nowMs)
      return

    if (!Number.isFinite(this.nativeBlankStartedAt)) {
      this.nativeBlankStartedAt = nowMs
      return
    }

    if (nowMs - this.nativeBlankStartedAt < NATIVE_SUBTITLE_BLANK_GRACE_MS)
      return

    previousSubtitle.end = Math.max(previousSubtitle.start + 1, nowMs)
    for (const subscriber of this.nativeSubscribers) {
      subscriber([previousSubtitle])
    }
  }
}

function readNativeSubtitleText(): string {
  const elements = document.querySelectorAll(STREAMING_NATIVE_SUBTITLES_SELECTOR)

  for (const element of elements) {
    const leafTexts = collapseRepeatedNativeLines([...element.querySelectorAll("span")]
      .map(span => span.textContent?.trim() ?? "")
      .filter(Boolean))

    const text = leafTexts.length > 0
      ? leafTexts.join("\n")
      : element.textContent ?? ""

    const normalizedText = text
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim()

    if (normalizedText)
      return collapseDuplicatedSubtitleText(normalizedText)
  }

  return ""
}

function normalizeOfficialSubtitles(subtitles: SubtitlesFragment[]): SubtitlesFragment[] {
  return subtitles.map(subtitle => ({
    ...subtitle,
    text: collapseDuplicatedSubtitleText(subtitle.text),
  }))
}

function collapseDuplicatedSubtitleText(text: string): string {
  const lines = collapseRepeatedNativeLines(text.split("\n").map(line => line.trim()).filter(Boolean))
  const firstLine = lines[0]
  const rest = lines.slice(1)
  if (firstLine && rest.length > 0 && toNativeTextFingerprint(firstLine) === toNativeTextFingerprint(rest.join("")))
    return rest.join("\n")

  return lines.join("\n")
}

function collapseRepeatedNativeLines(texts: string[]): string[] {
  const compact = texts.filter((text, index) => index === 0 || text !== texts[index - 1])
  const half = compact.length / 2
  if (compact.length > 1 && Number.isInteger(half)
    && compact.slice(0, half).every((text, index) => text === compact[index + half])) {
    return compact.slice(0, half)
  }

  return compact
}

function toNativeTextFingerprint(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase()
}

function shouldPreferNativeSubtitles(): boolean {
  return /(?:^|\.)netflix\.com$/i.test(window.location.hostname)
}
