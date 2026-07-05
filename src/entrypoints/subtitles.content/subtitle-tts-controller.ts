import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
import type { SubtitleTtsConfig } from "@/types/config/subtitles"
import type { TTSConfig } from "@/types/config/tts"
import type { EdgeTTSSynthesizeWireResponse } from "@/types/edge-tts"
import type { TTSPlaybackStartResponse, TTSPlaybackStopReason } from "@/types/tts-playback"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { i18n } from "#imports"
import { selectTTSVoice } from "@/hooks/use-text-to-speech"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { sendMessage } from "@/utils/message"
import { splitTextByUtf8Bytes } from "@/utils/server/edge-tts/chunk"
import { currentSubtitleAtom, subtitlesStore } from "./atoms"

/**
 * Small gap between consecutive cues for natural pacing. Kept short so TTS
 * stays tightly synced with the on-screen captions.
 */
const INTER_CUE_GAP_MS = 80

/**
 * Tiny look-ahead window (ms). We allow the TTS to start a cue at most this
 * far before the video timeline reaches it, to mask synthesis latency. Kept
 * small on purpose: the goal is for audio to track the on-screen captions, not
 * to run ahead of them. Visible desync beyond this is undesirable.
 */
const CHASE_LOOKAHEAD_MS = 300

export interface SubtitleTTSControllerOptions {
  /** Returns the full subtitle list sorted by start time. */
  getFragments: () => SubtitlesFragment[]
  /** Returns the <video> element the TTS should follow. */
  getVideoElement: () => HTMLVideoElement | null
  /** Loads the latest config snapshot. */
  getConfig: () => Promise<Pick<Config, "videoSubtitles" | "tts" | "language"> | null>
}

interface CachedAudio {
  audioBase64: string
  contentType: string
}

function cacheKeyString(text: string, voice: string, rate: number): string {
  return `${voice}\u0000${rate}\u0000${text}`
}

function toSignedValue(value: number, unit: "%" | "Hz"): string {
  return `${value >= 0 ? "+" : ""}${value}${unit}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Estimate an MP3 audio clip's duration (seconds) from its base64 payload
 * without decoding it. Edge TTS emits 48 kbps mono MP3, so byte count maps to
 * duration linearly. Good enough for time-window alignment decisions; the
 * actual playback uses the real duration once the audio element loads it.
 *
 * base64 encodes 6 bits per char → bytes = chars * 3/4. 48 kbps = 6000 B/s.
 */
function estimateMp3DurationSeconds(audioBase64: string): number {
  const approxBytes = (audioBase64.length * 3) / 4
  return approxBytes / 6000
}

/**
 * Maximum time-stretch factor. Beyond this the voice sounds unnatural, so we
 * cap acceleration and accept that very long cues will run slightly past their
 * window rather than sounding chipmunk-like.
 */
const MAX_PLAYBACK_RATE = 1.6

/**
 * SubtitleTTSController reads subtitle cues aloud via Edge TTS using a
 * duration-aware "smooth chase" strategy.
 *
 * A single async playback loop pulls cues in order. Each iteration synthesizes
 * the cue (from a warm cache whenever possible), plays it to completion
 * (`ttsPlaybackStart` resolves on the audio element's `onended`), then advances.
 * The next cue's audio is pre-synthesized during the current cue's playback, so
 * cue transitions have no synthesis-latency gap. The loop is decoupled from the
 * subtitle time window: if TTS audio runs longer than the cue's window,
 * narration simply continues (the viewer hears the full translation). Seeks and
 * pauses cancel the loop via a generation token; a new loop re-anchors to the
 * new video position.
 */
export class SubtitleTTSController {
  private active = false
  /** Monotonic generation token. Incremented on stop/seek to invalidate loops. */
  private generation = 0
  private readonly audioCache = new Map<string, CachedAudio>()
  private readonly inflightSynth = new Map<string, Promise<CachedAudio>>()

  private getFragments: () => SubtitlesFragment[]
  private getVideoElement: () => HTMLVideoElement | null
  private getConfig: () => Promise<Pick<Config, "videoSubtitles" | "tts" | "language"> | null>

  /** Start time of the most recently played cue, to avoid replaying it. */
  private lastPlayedStart: number | null = null

  constructor(options: SubtitleTTSControllerOptions) {
    this.getFragments = options.getFragments
    this.getVideoElement = options.getVideoElement
    this.getConfig = options.getConfig
  }

  /** Begin the playback loop. Returns immediately; loop runs in background. */
  start(): void {
    if (this.active)
      return
    this.active = true
    this.generation += 1

    const video = this.getVideoElement()
    video?.addEventListener("pause", this.handleVideoPause)
    video?.addEventListener("seeking", this.handleVideoSeeking)

    void this.runPlaybackLoop(this.generation)
  }

  stop(): void {
    if (!this.active)
      return
    this.active = false
    this.generation += 1

    const video = this.getVideoElement()
    video?.removeEventListener("pause", this.handleVideoPause)
    video?.removeEventListener("seeking", this.handleVideoSeeking)

    void this.stopPlayback(undefined, "stopped").catch(() => {})
  }

  /** Clear cached audio (e.g. on session reset / video navigation). */
  clearCache(): void {
    this.audioCache.clear()
    this.inflightSynth.clear()
  }

  private handleVideoPause = (): void => {
    void this.stopPlayback(undefined, "interrupted").catch(() => {})
  }

  private handleVideoSeeking = (): void => {
    this.generation += 1
    // Seek invalidates the "already played" memory so the cue at the new
    // position can play again.
    this.lastPlayedStart = null
    void this.stopPlayback(undefined, "interrupted").catch(() => {})
    if (this.active) {
      void this.runPlaybackLoop(this.generation)
    }
  }

  /** The core playback loop. Each iteration plays one cue to completion. */
  private async runPlaybackLoop(gen: number): Promise<void> {
    // Prepare the offscreen document with a timeout — if background doesn't
    // respond we keep going rather than stalling the whole loop forever.
    try {
      await Promise.race([
        sendMessage("ttsPlaybackPrepare"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("prepare timeout")), 5000)),
      ])
    }
    catch (error) {
      console.warn("[SubtitleTTS] playback prepare failed (continuing anyway)", String(error))
    }

    while (this.active && gen === this.generation) {
      const config = await this.getConfig()
      if (!config || gen !== this.generation)
        return

      const ttsConfig = config.videoSubtitles.tts
      if (!ttsConfig.enabled)
        return

      const cue = this.pickNextCue()
      if (!cue) {
        // Between cues. Sleep precisely until the next cue's window opens,
        // rather than polling blindly — this eliminates the perceived "wait"
        // after a new caption appears. Capped to avoid stalling if the video is
        // paused (no timeupdate to wake us).
        const nextStart = this.getNextCueStartMs()
        if (nextStart !== null) {
          const video = this.getVideoElement()
          const nowMs = video ? video.currentTime * 1000 : 0
          const waitMs = Math.max(50, Math.min(nextStart - nowMs, 1000))
          await sleep(waitMs)
        }
        else {
          await sleep(200)
        }
        continue
      }

      const text = this.pickText(cue, ttsConfig)
      if (!text) {
        // Cue exists but its target field is empty (e.g. translation pending).
        await sleep(150)
        continue
      }

      if (gen !== this.generation)
        return

      const voice = this.resolveVoice(text, ttsConfig, config)
      const effective = this.effectiveTtsConfig(ttsConfig, config.tts)
      // Mark this cue as played so the next iteration doesn't replay it when
      // TTS is running ahead of the video timeline.
      this.lastPlayedStart = cue.start
      this.warmNextCue(cue, ttsConfig, config)

      try {
        const audio = await this.synthesize(text, voice, effective)
        if (gen !== this.generation)
          return
        // Fit audio into the cue's time window via real-time stretching when
        // the translation is longer than the original, so TTS stays in sync
        // with the video timeline.
        const windowMs = cue.end - cue.start
        const result = await this.startPlayback(audio, gen, windowMs)
        if (!result.ok)
          return
      }
      catch (error) {
        console.warn("[SubtitleTTS] cue failed, skipping", { text, error: String(error) })
      }

      if (gen !== this.generation)
        return

      await sleep(INTER_CUE_GAP_MS)
    }
  }

  /** Pre-synthesize the cue after `cue` so the next iteration hits cache. */
  private warmNextCue(cue: SubtitlesFragment, ttsConfig: SubtitleTtsConfig, config: Pick<Config, "videoSubtitles" | "tts" | "language">): void {
    const next = this.cueAfter(cue)
    if (!next)
      return
    const nextText = this.pickText(next, ttsConfig)
    if (!nextText)
      return
    const nextVoice = this.resolveVoice(nextText, ttsConfig, config)
    const nextEffective = this.effectiveTtsConfig(ttsConfig, config.tts)
    void this.synthesize(nextText, nextVoice, nextEffective).catch(() => {})
  }

  /**
   * Pick the cue that should play now. The cue must be the one the video is
   * currently inside (or within CHASE_LOOKAHEAD_MS of entering), and must not
   * be the one just played. Returns null when between cues — the caller then
   * sleeps until the next cue's start time rather than polling blindly.
   *
   * Also exposes the next upcoming cue's start (via getNextCueStartMs) so the
   * loop can sleep precisely instead of polling every 200ms.
   */
  private pickNextCue(): SubtitlesFragment | null {
    const fragments = this.getFragments()
    const video = this.getVideoElement()
    const nowMs = video ? video.currentTime * 1000 : 0

    if (fragments.length > 0) {
      // 1) Currently inside a cue window — play it (unless it's the one we just
      //    finished, in which case we wait for the next cue rather than replay).
      const current = fragments.find(f => f.start <= nowMs && f.end > nowMs && f.start !== this.lastPlayedStart)
      if (current)
        return current

      // 2) The timeline is between cues. Only chase the next cue if it starts
      //    within the small look-ahead window; otherwise return null so the loop
      //    sleeps precisely until the cue's window opens. This keeps audio in
      //    lockstep with the on-screen captions.
      const upcoming = fragments.find(f => f.start > nowMs && f.start !== this.lastPlayedStart)
      if (upcoming && upcoming.start - nowMs <= CHASE_LOOKAHEAD_MS)
        return upcoming

      // Between cues with a gap > look-ahead — return null to trigger a
      // precise sleep until the next cue. (Intentionally not falling through to
      // the store cue, which would re-trigger the just-played one.)
      return null
    }

    // Fragments not populated yet — fall back to the store's current cue.
    const storeCue = subtitlesStore.get(currentSubtitleAtom)
    if (storeCue && storeCue.start === this.lastPlayedStart)
      return null
    return storeCue
  }

  /** Returns the start time (ms) of the next unplayed cue, or null. */
  private getNextCueStartMs(): number | null {
    const fragments = this.getFragments()
    const video = this.getVideoElement()
    const nowMs = video ? video.currentTime * 1000 : 0
    const next = fragments.find(f => f.start > nowMs && f.start !== this.lastPlayedStart)
    return next?.start ?? null
  }

  private cueAfter(cue: SubtitlesFragment): SubtitlesFragment | null {
    const fragments = this.getFragments()
    const idx = fragments.findIndex(f => f.start === cue.start)
    if (idx === -1 || idx + 1 >= fragments.length)
      return null
    return fragments[idx + 1] ?? null
  }

  private pickText(subtitle: SubtitlesFragment, ttsConfig: SubtitleTtsConfig): string {
    if (ttsConfig.readTarget === "original")
      return subtitle.text?.trim() ?? ""
    // Translation requested. Fall back to the original text when the
    // translation hasn't arrived yet (async batch translation may not have
    // reached this cue), so TTS isn't silent for an extended period.
    const translation = subtitle.translation?.trim()
    if (translation)
      return translation
    return subtitle.text?.trim() ?? ""
  }

  private resolveVoice(_text: string, ttsConfig: SubtitleTtsConfig, config: Pick<Config, "tts" | "language">): string {
    if (ttsConfig.voiceMode === "custom" && ttsConfig.customVoice)
      return ttsConfig.customVoice
    const langHint: LangCodeISO6393 | undefined
      = ttsConfig.readTarget === "translation"
        ? config.language.targetCode
        : (config.language.sourceCode === "auto" ? undefined : config.language.sourceCode)
    return selectTTSVoice(config.tts, langHint)
  }

  private effectiveTtsConfig(ttsConfig: SubtitleTtsConfig, globalTts: TTSConfig): TTSConfig {
    return {
      ...globalTts,
      rate: Math.max(-100, Math.min(100, globalTts.rate + ttsConfig.rate)),
    }
  }

  /** Synthesize with memoization + concurrent-request de-duplication. */
  private async synthesize(text: string, voice: string, tts: TTSConfig): Promise<CachedAudio> {
    const keyStr = cacheKeyString(text, voice, tts.rate)

    const cached = this.audioCache.get(keyStr)
    if (cached)
      return cached

    const inflight = this.inflightSynth.get(keyStr)
    if (inflight)
      return inflight

    const promise = (async (): Promise<CachedAudio> => {
      const chunks = splitTextByUtf8Bytes(text)
      const responses = await Promise.all(
        chunks.map(chunk => this.synthesizeChunk(chunk, voice, tts)),
      )
      const audioBase64 = responses.map(r => r.audioBase64).join("")
      const contentType = responses[0]?.contentType ?? "audio/mpeg"
      const result: CachedAudio = { audioBase64, contentType }
      if (this.audioCache.size > 200)
        this.audioCache.clear()
      this.audioCache.set(keyStr, result)
      return result
    })()

    this.inflightSynth.set(keyStr, promise)
    try {
      return await promise
    }
    finally {
      this.inflightSynth.delete(keyStr)
    }
  }

  private async synthesizeChunk(
    chunk: string,
    voice: string,
    tts: TTSConfig,
  ): Promise<{ audioBase64: string, contentType: string }> {
    const response: EdgeTTSSynthesizeWireResponse = await sendMessage("edgeTtsSynthesize", {
      text: chunk,
      voice,
      rate: toSignedValue(tts.rate, "%"),
      pitch: toSignedValue(tts.pitch, "Hz"),
      volume: toSignedValue(tts.volume, "%"),
    })

    if (!response.ok)
      throw new Error(`[${response.error.code}] ${response.error.message}`)
    if (!response.audioBase64)
      throw new Error(i18n.t("speak.failedToGenerateSpeech") || "Edge TTS returned empty audio data")
    return { audioBase64: response.audioBase64, contentType: response.contentType }
  }

  /**
   * Play one cue's audio. Resolves on completion (onended) or interruption.
   * When `fitWindowMs` is provided, the audio's playback rate is adjusted so it
   * fits within that time window (clamped to natural-sounding bounds).
   */
  private async startPlayback(
    audio: CachedAudio,
    gen: number,
    fitWindowMs?: number,
  ): Promise<TTSPlaybackStartResponse> {
    if (gen !== this.generation)
      return { ok: false, reason: "stopped" }
    await this.stopPlayback(undefined, "interrupted")
    if (gen !== this.generation)
      return { ok: false, reason: "stopped" }

    // Decide whether to time-stretch. Only speed up (audio longer than window);
    // never speed down past MIN_PLAYBACK_RATE, since slowing natural speech
    // sounds worse than letting it finish early.
    let playbackRate: number | undefined
    if (fitWindowMs && fitWindowMs > 0) {
      const naturalSec = estimateMp3DurationSeconds(audio.audioBase64)
      const windowSec = fitWindowMs / 1000
      if (naturalSec > windowSec) {
        const rate = Math.min(MAX_PLAYBACK_RATE, naturalSec / windowSec)
        if (rate > 1.05) {
          playbackRate = rate
        }
      }
    }

    const requestId = getRandomUUID()
    return sendMessage("ttsPlaybackStart", {
      requestId,
      audioBase64: audio.audioBase64,
      contentType: audio.contentType,
      ...(playbackRate ? { playbackRate } : {}),
    })
  }

  private async stopPlayback(
    explicitRequestId?: string,
    reason: TTSPlaybackStopReason = "interrupted",
  ): Promise<void> {
    try {
      await sendMessage("ttsPlaybackStop", { requestId: explicitRequestId, reason })
    }
    catch (error) {
      console.warn("[SubtitleTTS] stop playback failed", String(error))
    }
  }
}
