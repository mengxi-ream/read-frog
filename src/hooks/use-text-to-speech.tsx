import type {
  FeatureProviderAnalytics,
  FeatureUsageContext,
  SurfaceByFeature,
} from "@/types/analytics"
import type { TTSConfig } from "@/types/config/tts"
import type {
  TTSPlaybackStartRequest,
  TTSPlaybackStartResponse,
  TTSPlaybackStopRequest,
} from "@/types/tts-playback"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useRef, useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { classifyFailureReason } from "@/utils/analytics-failure-reason"
import { EDGE_TTS_FEATURE_PROVIDER } from "@/utils/analytics-provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { detectLanguage } from "@/utils/content/language"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { i18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { sendMessage } from "@/utils/message"
import { splitTextByUtf8Bytes } from "@/utils/server/edge-tts/chunk"
import {
  PLAYBACK_BLOCKED_MESSAGE,
  WebAudioPlaybackController,
} from "@/utils/tts-playback/web-audio-controller"

const log = createLogger("use-text-to-speech")

interface PlayAudioParams {
  text: string
  ttsConfig: TTSConfig
  analyticsContext: FeatureUsageContext<"text_to_speech"> & FeatureProviderAnalytics
  forcedVoice?: string
  // A run nobody pressed for (a layout reading a field as the answer arrives)
  // fails without a toast; pressing the trigger tries again and reports it.
  quiet?: boolean
}

interface SynthesizedAudioChunk {
  audioBase64: string
  contentType: string
}

const TTS_ERROR_TOAST_ID = "tts-synthesize-error"

// Safari plays in the document that asked, through one player that every
// reader in the document shares: its extension background cannot play audio,
// and it has no offscreen document. Every other browser plays from the
// background, which keeps one player for all tabs.
const documentPlayback =
  import.meta.env.BROWSER === "safari" ? new WebAudioPlaybackController() : null

async function preparePlayback(): Promise<void> {
  // Safari's player was prepared in play(), while the click still counted.
  if (documentPlayback) return
  await sendMessage("ttsPlaybackPrepare")
}

async function startPlayback(request: TTSPlaybackStartRequest): Promise<TTSPlaybackStartResponse> {
  return documentPlayback
    ? documentPlayback.play(request)
    : sendMessage("ttsPlaybackStart", request)
}

function stopPlayback(request: TTSPlaybackStopRequest): void {
  if (documentPlayback) {
    documentPlayback.stop(request)
    return
  }
  void sendMessage("ttsPlaybackStop", request).catch(() => {})
}

function toSignedValue(value: number, unit: "%" | "Hz"): string {
  return `${value >= 0 ? "+" : ""}${value}${unit}`
}

export function selectTTSVoice(
  ttsConfig: TTSConfig,
  detectedLanguage?: string | null,
  forcedVoice?: string,
): string {
  if (forcedVoice) {
    return forcedVoice
  }

  if (detectedLanguage && detectedLanguage in ttsConfig.languageVoices) {
    return (
      ttsConfig.languageVoices[detectedLanguage as keyof typeof ttsConfig.languageVoices] ??
      ttsConfig.defaultVoice
    )
  }

  return ttsConfig.defaultVoice
}

async function resolveVoiceForText(
  text: string,
  ttsConfig: TTSConfig,
  enableLLM: boolean,
  forcedVoice?: string,
): Promise<string> {
  if (forcedVoice) {
    log.debug("Using forced voice for text", {
      text,
      forcedVoice,
    })
    return forcedVoice
  }

  const detectedLanguage = await detectLanguage(text, {
    minLength: 0,
    enableLLM,
    // Voice detection can fall back without blocking speech. Tell the user
    // what happened and how to choose a working detection mode.
    llmFallbackToastContext: "speak",
  })
  log.debug("Resolving voice for text", {
    text,
    detectedLanguage,
    enableLLM,
  })

  return selectTTSVoice(ttsConfig, detectedLanguage)
}

function getTTSFriendlyErrorDescription(error: Error): string | undefined {
  if (error.message.includes("Edge TTS returned empty audio data")) {
    return "The current voice may not support this language. Try switching to a matching voice."
  }

  if (error.message.includes("[SYNTH_RATE_LIMITED]")) {
    return "Too many TTS requests. Please try again in a moment."
  }

  if (
    error.message.includes("[NETWORK_ERROR]") ||
    error.message.includes("[TOKEN_FETCH_FAILED]") ||
    error.message.includes("[TOKEN_INVALID]")
  ) {
    return "Edge TTS is temporarily unavailable. Please check your network and retry."
  }

  if (error.message.includes("message channel closed")) {
    return "Audio playback was interrupted. Please try again."
  }

  if (error.message.includes(PLAYBACK_BLOCKED_MESSAGE)) {
    return i18n.t("speak.playbackBlocked")
  }

  return error.message || undefined
}

function getTTSErrorTitle(error: Error): string {
  // The speech was generated; Safari would not play it.
  if (error.message.includes(PLAYBACK_BLOCKED_MESSAGE)) {
    return i18n.t("speak.failedToPlaySound")
  }

  return i18n.t("speak.failedToGenerateSpeech")
}

async function synthesizeEdgeTTSAudioChunk(
  chunk: string,
  voice: string,
  ttsConfig: TTSConfig,
): Promise<SynthesizedAudioChunk> {
  const response = await sendMessage("edgeTtsSynthesize", {
    text: chunk,
    voice,
    rate: toSignedValue(ttsConfig.rate, "%"),
    pitch: toSignedValue(ttsConfig.pitch, "Hz"),
    volume: toSignedValue(ttsConfig.volume, "%"),
  })

  if (!response.ok) {
    throw new Error(`[${response.error.code}] ${response.error.message}`)
  }

  if (!response.audioBase64) {
    throw new Error("Edge TTS returned empty audio data")
  }

  return {
    audioBase64: response.audioBase64,
    contentType: response.contentType,
  }
}

export function useTextToSpeech(
  surface: SurfaceByFeature["text_to_speech"] = ANALYTICS_SURFACE.SELECTION_TOOLBAR,
) {
  const queryClient = useQueryClient()
  const languageDetection = useAtomValue(configFieldsAtomMap.languageDetection)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentChunk, setCurrentChunk] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const shouldStopRef = useRef(false)
  const activeRequestIdRef = useRef<string | null>(null)

  const stop = () => {
    shouldStopRef.current = true

    const activeRequestId = activeRequestIdRef.current
    activeRequestIdRef.current = null
    if (activeRequestId) {
      stopPlayback({ requestId: activeRequestId })
    }

    setIsPlaying(false)
    setCurrentChunk(0)
    setTotalChunks(0)
  }

  const playMutation = useMutation<void, Error, PlayAudioParams>({
    meta: {
      suppressToast: true,
    },
    mutationFn: async ({ text, ttsConfig, analyticsContext, forcedVoice }) => {
      stop()
      shouldStopRef.current = false

      const requestId = getRandomUUID()
      activeRequestIdRef.current = requestId
      // A newer play() resets shouldStopRef, so a run still awaiting a fetch
      // must also check that it is still the active request; otherwise it
      // would resume, start its audio over the newer one and flip its state.
      const isSuperseded = () => shouldStopRef.current || activeRequestIdRef.current !== requestId
      try {
        await runPlayback(requestId, isSuperseded, {
          text,
          ttsConfig,
          analyticsContext,
          forcedVoice,
        })
      } catch (error) {
        // A run the user already stopped or replaced reports nothing.
        if (isSuperseded()) return
        // The failed run may have left its audio playing.
        activeRequestIdRef.current = null
        stopPlayback({ requestId })
        throw error
      }
    },
    onError: (error, variables) => {
      log.warn("Text-to-speech playback failed", { error })
      void trackFeatureUsed({
        ...variables.analyticsContext,
        outcome: "failure",
        failure_reason: classifyFailureReason(error),
      })
      if (!variables.quiet) {
        toastManager.add({
          type: "error",
          title: getTTSErrorTitle(error),
          id: TTS_ERROR_TOAST_ID,
          description: getTTSFriendlyErrorDescription(error),
        })
      }
      setIsPlaying(false)
      setCurrentChunk(0)
      setTotalChunks(0)
    },
  })

  async function runPlayback(
    requestId: string,
    isSuperseded: () => boolean,
    { text, ttsConfig, analyticsContext, forcedVoice }: PlayAudioParams,
  ) {
    let didStartPlayback = false

    const selectedVoice = await resolveVoiceForText(
      text,
      ttsConfig,
      languageDetection.mode === "llm",
      forcedVoice,
    )
    if (isSuperseded()) {
      return
    }
    const chunks = splitTextByUtf8Bytes(text)
    setTotalChunks(chunks.length)
    await preparePlayback()
    if (isSuperseded()) {
      return
    }

    const fetchChunkAudio = async (chunk: string) => {
      log.debug("Fetching chunk audio", {
        text: chunk,
        voice: selectedVoice,
        rate: ttsConfig.rate,
        pitch: ttsConfig.pitch,
        volume: ttsConfig.volume,
      })
      return queryClient.fetchQuery({
        queryKey: [
          "tts-audio",
          {
            text: chunk,
            voice: selectedVoice,
            rate: ttsConfig.rate,
            pitch: ttsConfig.pitch,
            volume: ttsConfig.volume,
          },
        ],
        queryFn: () => synthesizeEdgeTTSAudioChunk(chunk, selectedVoice, ttsConfig),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: 1000 * 60 * 10,
        meta: {
          suppressToast: true,
        },
      })
    }

    const playChunk = async (audioChunk: SynthesizedAudioChunk): Promise<boolean> => {
      // isPlaying belongs to the active run; a superseded one leaves it alone.
      if (!isSuperseded()) setIsPlaying(true)
      try {
        const playbackResult = await startPlayback({
          requestId,
          audioBase64: audioChunk.audioBase64,
          contentType: audioChunk.contentType,
        })
        if (playbackResult.ok) {
          didStartPlayback = true
        }
        return playbackResult.ok
      } finally {
        if (activeRequestIdRef.current === requestId) setIsPlaying(false)
      }
    }

    for (let index = 0; index < chunks.length; index++) {
      if (isSuperseded()) {
        break
      }

      setCurrentChunk(index + 1)
      const currentAudioPromise = fetchChunkAudio(chunks[index]!)
      const nextAudioPromise =
        index + 1 < chunks.length ? fetchChunkAudio(chunks[index + 1]!) : null
      // The loop may exit before awaiting this; the await below still rethrows.
      void nextAudioPromise?.catch(() => {})
      const audioChunk = await currentAudioPromise

      if (isSuperseded()) {
        break
      }

      const didPlay = await playChunk(audioChunk)
      if (!didPlay || isSuperseded()) {
        break
      }

      if (nextAudioPromise) {
        await nextAudioPromise
      }
    }

    if (activeRequestIdRef.current === requestId) {
      activeRequestIdRef.current = null
      setCurrentChunk(0)
      setTotalChunks(0)
    }

    if (didStartPlayback) {
      void trackFeatureUsed({
        ...analyticsContext,
        outcome: "success",
      })
    }
  }

  // `options.surface` reports a play started from somewhere other than the
  // hook's own surface (a keyboard shortcut for the toolbar's reader).
  const play = (
    text: string,
    ttsConfig: TTSConfig,
    options?: {
      forcedVoice?: string
      surface?: SurfaceByFeature["text_to_speech"]
      quiet?: boolean
    },
  ) => {
    // Inside the click, before anything is awaited: Safari starts audio only then.
    documentPlayback?.prepare()
    return playMutation.mutateAsync({
      text,
      ttsConfig,
      forcedVoice: options?.forcedVoice,
      quiet: options?.quiet,
      analyticsContext: {
        ...createFeatureUsageContext(ANALYTICS_FEATURE.TEXT_TO_SPEECH, options?.surface ?? surface),
        ...EDGE_TTS_FEATURE_PROVIDER,
      },
    })
  }

  const isFetching = playMutation.isPending && !isPlaying

  return {
    play,
    stop,
    isFetching,
    isPlaying,
    currentChunk,
    totalChunks,
    error: playMutation.error,
  }
}
