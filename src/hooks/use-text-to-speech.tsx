import type { AnalyticsSurface, FeatureUsageContext } from "@/types/analytics"
import type { TTSConfig } from "@/types/config/tts"
import type { TTSPlaybackStartResponse, TTSPlaybackStopReason } from "@/types/tts-playback"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { i18n } from "#imports"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { detectLanguage } from "@/utils/content/language"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { splitTextByUtf8Bytes } from "@/utils/server/edge-tts/chunk"

interface PlayAudioParams {
  text: string
  ttsConfig: TTSConfig
  analyticsContext: FeatureUsageContext
  forcedVoice?: string
}

interface SynthesizedAudioChunk {
  audioBase64: string
  contentType: string
}

interface BrowserAudioPlayback {
  requestId: string
  audio: HTMLAudioElement
  audioUrl: string
  settled: boolean
  settle: (response: TTSPlaybackStartResponse) => void
  reject: (error: Error) => void
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
    return ttsConfig.languageVoices[detectedLanguage as keyof typeof ttsConfig.languageVoices] ?? ttsConfig.defaultVoice
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

  if (error.message.includes("[NETWORK_ERROR]") || error.message.includes("[TOKEN_FETCH_FAILED]") || error.message.includes("[TOKEN_INVALID]")) {
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

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function createAudioUrl(audioBase64: string, contentType: string): string {
  const bytes = base64ToUint8Array(audioBase64)
  const audioBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(audioBuffer).set(bytes)
  return URL.createObjectURL(new Blob([audioBuffer], { type: contentType }))
}

function cleanupBrowserPlayback(playback: BrowserAudioPlayback) {
  playback.audio.onended = null
  playback.audio.onerror = null
  playback.audio.pause()
  playback.audio.removeAttribute("src")
  playback.audio.load()
  URL.revokeObjectURL(playback.audioUrl)
}

export function useTextToSpeech(surface: AnalyticsSurface = ANALYTICS_SURFACE.SELECTION_TOOLBAR) {
  const queryClient = useQueryClient()
  const languageDetection = useAtomValue(configFieldsAtomMap.languageDetection)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentChunk, setCurrentChunk] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const shouldStopRef = useRef(false)
  const activeRequestIdRef = useRef<string | null>(null)
  const browserPlaybackRef = useRef<BrowserAudioPlayback | null>(null)

  const settleBrowserPlayback = (
    playback: BrowserAudioPlayback,
    response: TTSPlaybackStartResponse,
  ): boolean => {
    if (playback.settled) {
      return false
    }

    playback.settled = true
    cleanupBrowserPlayback(playback)
    if (browserPlaybackRef.current === playback) {
      browserPlaybackRef.current = null
    }
    playback.settle(response)
    return true
  }

  const failBrowserPlayback = (
    playback: BrowserAudioPlayback,
    error: Error,
  ): boolean => {
    if (playback.settled) {
      return false
    }

    playback.settled = true
    cleanupBrowserPlayback(playback)
    if (browserPlaybackRef.current === playback) {
      browserPlaybackRef.current = null
    }
    playback.reject(error)
    return true
  }

  const stopBrowserPlayback = (reason: TTSPlaybackStopReason, requestId?: string) => {
    const playback = browserPlaybackRef.current
    if (!playback) {
      return false
    }

    if (requestId && playback.requestId !== requestId) {
      return false
    }

    return settleBrowserPlayback(playback, { ok: false, reason })
  }

  const startBrowserPlayback = (
    requestId: string,
    audioChunk: SynthesizedAudioChunk,
  ): Promise<TTSPlaybackStartResponse> => {
    stopBrowserPlayback("interrupted")

    if (typeof Audio !== "function") {
      throw new TypeError("Audio playback is unavailable in this browser context")
    }

    return new Promise<TTSPlaybackStartResponse>((resolve, reject) => {
      const audioUrl = createAudioUrl(audioChunk.audioBase64, audioChunk.contentType)
      const audio = new Audio(audioUrl)

      const playback: BrowserAudioPlayback = {
        requestId,
        audio,
        audioUrl,
        settled: false,
        settle: resolve,
        reject,
      }

      browserPlaybackRef.current = playback

      audio.onended = () => {
        settleBrowserPlayback(playback, { ok: true })
      }

      audio.onerror = () => {
        failBrowserPlayback(playback, new Error("Failed to play audio in this browser context"))
      }

      audio.play().catch((error) => {
        const normalizedError = error instanceof Error
          ? error
          : new Error(typeof error === "string" ? error : "Unknown audio playback error")
        failBrowserPlayback(playback, normalizedError)
      })
    })
  }

  const stop = () => {
    shouldStopRef.current = true

    const activeRequestId = activeRequestIdRef.current
    activeRequestIdRef.current = null
    stopBrowserPlayback("stopped", activeRequestId ?? undefined)
    if (activeRequestId && !import.meta.env.FIREFOX) {
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
      let didStartPlayback = false

      const selectedVoice = await resolveVoiceForText(text, ttsConfig, languageDetection.mode === "llm", forcedVoice)
      if (shouldStopRef.current || activeRequestIdRef.current !== requestId) {
        return
      }
      const chunks = splitTextByUtf8Bytes(text)
      setTotalChunks(chunks.length)
      if (!import.meta.env.FIREFOX) {
        await sendMessage("ttsPlaybackEnsureOffscreen")
      }

      const fetchChunkAudio = async (chunk: string) => {
        logger.info("[TextToSpeech] Fetching chunk audio", { text: chunk, voice: selectedVoice, rate: ttsConfig.rate, pitch: ttsConfig.pitch, volume: ttsConfig.volume })
        return queryClient.fetchQuery({
          queryKey: ["tts-audio", { text: chunk, voice: selectedVoice, rate: ttsConfig.rate, pitch: ttsConfig.pitch, volume: ttsConfig.volume }],
          queryFn: () => synthesizeEdgeTTSAudioChunk(chunk, selectedVoice, ttsConfig),
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
          const playbackResult = import.meta.env.FIREFOX
            ? await startBrowserPlayback(requestId, audioChunk)
            : await sendMessage("ttsPlaybackStart", {
                requestId,
                audioBase64: audioChunk.audioBase64,
                contentType: audioChunk.contentType,
              })
          if (playbackResult.ok) {
            didStartPlayback = true
          }
          return playbackResult.ok
        }
        finally {
          setIsPlaying(false)
        }
      }

      for (let index = 0; index < chunks.length; index++) {
        if (shouldStopRef.current) {
          break
        }

        setCurrentChunk(index + 1)
        const currentAudioPromise = fetchChunkAudio(chunks[index]!)
        const nextAudioPromise = index + 1 < chunks.length ? fetchChunkAudio(chunks[index + 1]!) : null
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
      toast.error(i18n.t("speak.failedToGenerateSpeech"), {
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
    return playMutation.mutateAsync({
      text,
      ttsConfig,
      forcedVoice: options?.forcedVoice,
      analyticsContext: createFeatureUsageContext(
        ANALYTICS_FEATURE.TEXT_TO_SPEECH,
        surface,
      ),
    }).catch(() => {
      // Errors are surfaced through onError; callers intentionally fire-and-forget playback.
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
