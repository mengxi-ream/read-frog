import type {
  AnalyticsSurface,
  FeatureProviderAnalytics,
  FeatureUsageContext,
} from "@/types/analytics"
import type { Config } from "@/types/config/config"
import type { TTSConfig } from "@/types/config/tts"
import type { MiniMaxTTSConfig } from "@/types/minimax-tts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useRef, useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { EDGE_TTS_FEATURE_PROVIDER } from "@/utils/analytics-provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_MINIMAX_TTS_CONFIG } from "@/utils/constants/tts"
import { detectLanguage } from "@/utils/content/language"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { splitTextByUtf8Bytes } from "@/utils/server/edge-tts/chunk"

interface PlayAudioParams {
  text: string
  ttsConfig: TTSConfig
  analyticsContext: FeatureUsageContext & FeatureProviderAnalytics
  forcedVoice?: string
}

interface SynthesizedAudioChunk {
  audioBase64: string
  contentType: string
}

type MiniMaxProviderConfig = Extract<Config["providersConfig"][number], { provider: "minimax" }>

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
  })
  logger.info("[TextToSpeech] Resolving voice for text", {
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
    return "The speech service is temporarily unavailable. Please check your network and retry."
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

async function synthesizeMiniMaxAudioChunk(
  chunk: string,
  config: MiniMaxTTSConfig,
  apiKey: string,
): Promise<SynthesizedAudioChunk> {
  const response = await sendMessage("minimaxTtsSynthesize", {
    ...config,
    apiKey,
    text: chunk,
  })

  if (!response.ok) {
    throw new Error(`[${response.error.code}] ${response.error.message}`)
  }

  if (!response.audioBase64) {
    throw new Error("The speech API returned empty audio data")
  }

  return {
    audioBase64: response.audioBase64,
    contentType: response.contentType,
  }
}

function findMiniMaxProvider(
  providersConfig: Config["providersConfig"],
): MiniMaxProviderConfig | undefined {
  return providersConfig.find(
    (provider): provider is MiniMaxProviderConfig =>
      provider.provider === "minimax" && provider.enabled && Boolean(provider.apiKey?.trim()),
  )
}

export function useTextToSpeech(surface: AnalyticsSurface = ANALYTICS_SURFACE.SELECTION_TOOLBAR) {
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

      const backend = ttsConfig.backend ?? "edge"
      const minimaxConfig = ttsConfig.minimax ?? DEFAULT_MINIMAX_TTS_CONFIG
      const minimaxProvider = backend === "minimax" ? findMiniMaxProvider(providersConfig) : null
      const minimaxApiKey = minimaxProvider?.apiKey?.trim()
      if (backend === "minimax" && !minimaxApiKey) {
        throw new Error(
          "Configure an enabled MiniMax provider with an API key before using MiniMax speech.",
        )
      }
      if (backend === "minimax" && !minimaxConfig.voiceId.trim()) {
        throw new Error("Enter a MiniMax voice ID before generating speech.")
      }

      const requestId = getRandomUUID()
      activeRequestIdRef.current = requestId
      let didStartPlayback = false

      const selectedVoice =
        backend === "edge"
          ? await resolveVoiceForText(
              text,
              ttsConfig,
              languageDetection.mode === "llm",
              forcedVoice,
            )
          : minimaxConfig.voiceId.trim()
      if (shouldStopRef.current || activeRequestIdRef.current !== requestId) {
        return
      }
      const chunks = splitTextByUtf8Bytes(text)
      setTotalChunks(chunks.length)
      await sendMessage("ttsPlaybackPrepare")

      const fetchChunkAudio = async (chunk: string) => {
        logger.info("[TextToSpeech] Fetching chunk audio", {
          text: chunk,
          backend,
          voice: selectedVoice,
          model: backend === "minimax" ? minimaxConfig.model : undefined,
        })
        return queryClient.fetchQuery({
          queryKey: [
            "tts-audio",
            {
              text: chunk,
              backend,
              voice: selectedVoice,
              rate: backend === "edge" ? ttsConfig.rate : undefined,
              pitch: backend === "edge" ? ttsConfig.pitch : undefined,
              volume: backend === "edge" ? ttsConfig.volume : undefined,
              region: backend === "minimax" ? minimaxConfig.region : undefined,
              model: backend === "minimax" ? minimaxConfig.model : undefined,
              audioFormat: backend === "minimax" ? minimaxConfig.audioFormat : undefined,
            },
          ],
          queryFn: () =>
            backend === "edge"
              ? synthesizeEdgeTTSAudioChunk(chunk, selectedVoice, ttsConfig)
              : synthesizeMiniMaxAudioChunk(chunk, minimaxConfig, minimaxApiKey ?? ""),
          staleTime: Number.POSITIVE_INFINITY,
          gcTime: 1000 * 60 * 10,
          meta: {
            suppressToast: true,
          },
        })
      }

      const playChunk = async (audioChunk: SynthesizedAudioChunk): Promise<boolean> => {
        setIsPlaying(true)
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
          setIsPlaying(false)
        }
      }

      for (let index = 0; index < chunks.length; index++) {
        if (shouldStopRef.current) {
          break
        }

        setCurrentChunk(index + 1)
        const currentAudioPromise = fetchChunkAudio(chunks[index]!)
        const nextAudioPromise =
          index + 1 < chunks.length ? fetchChunkAudio(chunks[index + 1]!) : null
        const audioChunk = await currentAudioPromise

        if (shouldStopRef.current) {
          break
        }

        const didPlay = await playChunk(audioChunk)
        if (!didPlay || shouldStopRef.current) {
          break
        }

        if (nextAudioPromise) {
          await nextAudioPromise
        }
      }

      if (activeRequestIdRef.current === requestId) {
        activeRequestIdRef.current = null
      }
      setCurrentChunk(0)
      setTotalChunks(0)

      if (didStartPlayback) {
        void trackFeatureUsed({
          ...analyticsContext,
          outcome: "success",
        })
      }
    },
    onError: (error, variables) => {
      void trackFeatureUsed({
        ...variables.analyticsContext,
        outcome: "failure",
      })
      toastManager.add({
        type: "error",
        title: i18n.t("speak.failedToGenerateSpeech"),
        id: TTS_ERROR_TOAST_ID,
        description: getTTSFriendlyErrorDescription(error),
      })
      activeRequestIdRef.current = null
      setIsPlaying(false)
      setCurrentChunk(0)
      setTotalChunks(0)
    },
  })

  const play = (text: string, ttsConfig: TTSConfig, options?: { forcedVoice?: string }) => {
    const providerAnalytics: FeatureProviderAnalytics =
      (ttsConfig.backend ?? "edge") === "minimax"
        ? { provider: "minimax", backend_kind: "llm" }
        : EDGE_TTS_FEATURE_PROVIDER

    return playMutation.mutateAsync({
      text,
      ttsConfig,
      forcedVoice: options?.forcedVoice,
      analyticsContext: {
        ...createFeatureUsageContext(ANALYTICS_FEATURE.TEXT_TO_SPEECH, surface),
        ...providerAnalytics,
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
