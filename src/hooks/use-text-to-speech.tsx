import type {
  AnalyticsFailureReason,
  FeatureProviderAnalytics,
  FeatureUsageContext,
  SurfaceByFeature,
} from "@/types/analytics"
import type { TTSConfig, TTSProvider } from "@/types/config/tts"
import type { GeminiTTSErrorCode, GoogleProviderConfig } from "@/types/gemini-tts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useRef, useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { classifyFailureReason } from "@/utils/analytics-failure-reason"
import { classifyProviderConfig, EDGE_TTS_FEATURE_PROVIDER } from "@/utils/analytics-provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { detectLanguage } from "@/utils/content/language"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { splitTextByUtf8Bytes } from "@/utils/server/edge-tts/chunk"
import { EdgeTTSError } from "@/utils/server/edge-tts/errors"
import { resolveGeminiTTSProvider } from "@/utils/tts/gemini-providers"

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
  // Gemini voices read every language, so there is nothing to detect. A forced
  // voice names an Edge voice (a layout's data-speak-lang), which Gemini lacks.
  if (ttsConfig.provider === "gemini") {
    return ttsConfig.gemini.voice
  }

  if (forcedVoice) {
    logger.info("[TextToSpeech] Using forced voice for text", {
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
  logger.info("[TextToSpeech] Resolving voice for text", {
    text,
    detectedLanguage,
    enableLLM,
  })

  return selectTTSVoice(ttsConfig, detectedLanguage)
}

// The engines share some error codes (NETWORK_ERROR), so each reads its own.
function getTTSFriendlyErrorDescription(error: Error, engine: TTSProvider): string | undefined {
  return engine === "gemini"
    ? getGeminiTTSFriendlyErrorDescription(error)
    : getEdgeTTSFriendlyErrorDescription(error)
}

function getGeminiTTSFriendlyErrorDescription(error: Error): string | undefined {
  if (error.message.includes("[MISSING_PROVIDER]")) {
    return "Choose a Google provider for Gemini TTS on the Text to Speech settings page."
  }

  if (error.message.includes("[MISSING_API_KEY]")) {
    return "Add an API key to the Google provider in API Providers."
  }

  if (error.message.includes("[RATE_LIMITED]")) {
    return "Too many TTS requests. Please try again in a moment."
  }

  if (error.message.includes("[NETWORK_ERROR]")) {
    return "Gemini TTS is temporarily unavailable. Please check your network and retry."
  }

  // Text is split with Edge TTS's chunker, whose length error names Edge.
  if (error instanceof EdgeTTSError && error.code === "TEXT_TOO_LONG") {
    return "The text is too long to read aloud at once. Select a shorter passage."
  }

  return error.message || undefined
}

function getEdgeTTSFriendlyErrorDescription(error: Error): string | undefined {
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

  return error.message || undefined
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

type GeminiTTSFailureCode = GeminiTTSErrorCode | "MISSING_PROVIDER"

const GEMINI_TTS_FAILURE_REASONS = {
  MISSING_PROVIDER: "precheck",
  INVALID_TEXT: "precheck",
  MISSING_API_KEY: "missing_api_key",
  RATE_LIMITED: "rate_limited",
  NETWORK_ERROR: "network",
  EMPTY_AUDIO: "invalid_output",
  REQUEST_REJECTED: "provider_error",
  SERVER_ERROR: "provider_error",
} as const satisfies Record<GeminiTTSFailureCode, AnalyticsFailureReason>

function getGeminiTTSFailureReason(
  code: GeminiTTSFailureCode,
  status?: number,
): AnalyticsFailureReason {
  // A rejected key reads as an auth failure, as the AI SDK's 401/403 do for other features.
  if (code === "REQUEST_REJECTED" && (status === 401 || status === 403)) {
    return "provider_auth"
  }
  return GEMINI_TTS_FAILURE_REASONS[code]
}

// Carries an analytics `reason`, which classifyFailureReason reads; a bare message would be
// reported as "unknown".
function createGeminiTTSError(code: GeminiTTSFailureCode, message: string, status?: number) {
  return Object.assign(new Error(`[${code}] ${message}`), {
    reason: getGeminiTTSFailureReason(code, status),
  })
}

async function synthesizeGeminiTTSAudioChunk(
  chunk: string,
  ttsConfig: TTSConfig,
  providerConfig: GoogleProviderConfig | null,
): Promise<SynthesizedAudioChunk> {
  if (!providerConfig) {
    throw createGeminiTTSError("MISSING_PROVIDER", "No Google provider is selected for Gemini TTS")
  }

  const response = await sendMessage("geminiTtsSynthesize", {
    text: chunk,
    providerConfig,
    model: ttsConfig.gemini.model,
    voice: ttsConfig.gemini.voice,
    style: ttsConfig.gemini.style,
  })

  if (!response.ok) {
    const { code, message, status } = response.error
    throw createGeminiTTSError(code, message, status)
  }

  return {
    audioBase64: response.audioBase64,
    contentType: response.contentType,
  }
}

function synthesizeAudioChunk(
  chunk: string,
  voice: string,
  ttsConfig: TTSConfig,
  geminiProvider: GoogleProviderConfig | null,
): Promise<SynthesizedAudioChunk> {
  return ttsConfig.provider === "gemini"
    ? synthesizeGeminiTTSAudioChunk(chunk, ttsConfig, geminiProvider)
    : synthesizeEdgeTTSAudioChunk(chunk, voice, ttsConfig)
}

export function useTextToSpeech(
  surface: SurfaceByFeature["text_to_speech"] = ANALYTICS_SURFACE.SELECTION_TOOLBAR,
) {
  const queryClient = useQueryClient()
  const languageDetection = useAtomValue(configFieldsAtomMap.languageDetection)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
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
      void sendMessage("ttsPlaybackStop", { requestId: activeRequestId }).catch(() => {})
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
        throw error
      }
    },
    onError: (error, variables) => {
      void trackFeatureUsed({
        ...variables.analyticsContext,
        outcome: "failure",
        failure_reason: classifyFailureReason(error),
      })
      if (!variables.quiet) {
        toastManager.add({
          type: "error",
          title: i18n.t("speak.failedToGenerateSpeech"),
          id: TTS_ERROR_TOAST_ID,
          description: getTTSFriendlyErrorDescription(error, variables.ttsConfig.provider),
        })
      }
      activeRequestIdRef.current = null
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
    await sendMessage("ttsPlaybackPrepare")
    if (isSuperseded()) {
      return
    }

    // Resolved once per run, so every chunk of it speaks through the same provider.
    const geminiProvider =
      ttsConfig.provider === "gemini"
        ? resolveGeminiTTSProvider(providersConfig, ttsConfig.gemini.providerId)
        : null

    // Keyed on exactly what makes the audio. For Gemini that includes the key, base URL and
    // headers it goes out with, so a changed account or route is never answered from audio the
    // old one made, while renaming the provider or moving an Edge dial still finds the cache.
    const audioKey =
      ttsConfig.provider === "gemini"
        ? {
            engine: ttsConfig.provider,
            model: ttsConfig.gemini.model,
            voice: ttsConfig.gemini.voice,
            style: ttsConfig.gemini.style,
            connection: geminiProvider && {
              apiKey: geminiProvider.apiKey,
              baseURL: geminiProvider.baseURL,
              headers: geminiProvider.headers,
            },
          }
        : {
            engine: ttsConfig.provider,
            voice: selectedVoice,
            rate: ttsConfig.rate,
            pitch: ttsConfig.pitch,
            volume: ttsConfig.volume,
          }

    const fetchChunkAudio = async (chunk: string) => {
      logger.info("[TextToSpeech] Fetching chunk audio", {
        text: chunk,
        voice: selectedVoice,
        rate: ttsConfig.rate,
        pitch: ttsConfig.pitch,
        volume: ttsConfig.volume,
      })
      return queryClient.fetchQuery({
        queryKey: ["tts-audio", { ...audioKey, text: chunk }],
        queryFn: () => synthesizeAudioChunk(chunk, selectedVoice, ttsConfig, geminiProvider),
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
        const playbackResult = await sendMessage("ttsPlaybackStart", {
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
      const audioChunk = await fetchChunkAudio(chunks[index]!)

      if (isSuperseded()) {
        break
      }

      // The next chunk is fetched while this one plays, but only once this one has arrived:
      // Gemini bills every request, so a run stopped before its first audio pays for one chunk.
      const nextAudioPromise =
        index + 1 < chunks.length ? fetchChunkAudio(chunks[index + 1]!) : null
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
    return playMutation.mutateAsync({
      text,
      ttsConfig,
      forcedVoice: options?.forcedVoice,
      quiet: options?.quiet,
      analyticsContext: {
        ...createFeatureUsageContext(ANALYTICS_FEATURE.TEXT_TO_SPEECH, options?.surface ?? surface),
        ...(ttsConfig.provider === "gemini"
          ? classifyProviderConfig(
              resolveGeminiTTSProvider(providersConfig, ttsConfig.gemini.providerId),
            )
          : EDGE_TTS_FEATURE_PROVIDER),
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
