import type { TTSConfig } from "@/types/config/tts"
import { i18n } from "#imports"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { detectLanguage } from "@/utils/content/language"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { splitTextByUtf8Bytes } from "@/utils/server/edge-tts/chunk"

interface PlayAudioParams {
  text: string
  ttsConfig: TTSConfig
}

interface SynthesizedAudioChunk {
  audioBase64: string
  contentType: string
}

const TTS_ERROR_TOAST_ID = "tts-synthesize-error"

function toSignedValue(value: number, unit: "%" | "Hz"): string {
  return `${value >= 0 ? "+" : ""}${value}${unit}`
}

async function resolveVoiceForText(text: string, ttsConfig: TTSConfig): Promise<string> {
  const detectedLanguage = await detectLanguage(text, {
    minLength: 0,
    enableLLM: ttsConfig.detectLanguageMode === "llm",
  })
  logger.info("[TextToSpeech] Resolving voice for text", {
    text,
    detectedLanguage,
    detectionMode: ttsConfig.detectLanguageMode,
  })

  if (detectedLanguage && detectedLanguage in ttsConfig.languageVoices) {
    return ttsConfig.languageVoices[detectedLanguage as keyof typeof ttsConfig.languageVoices] ?? ttsConfig.defaultVoice
  }

  return ttsConfig.defaultVoice
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

export function useTextToSpeech() {
  const queryClient = useQueryClient()
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
    mutationFn: async ({ text, ttsConfig }) => {
      stop()
      shouldStopRef.current = false

      const requestId = crypto.randomUUID()
      activeRequestIdRef.current = requestId

      const selectedVoice = await resolveVoiceForText(text, ttsConfig)
      if (shouldStopRef.current || activeRequestIdRef.current !== requestId) {
        return
      }
      const chunks = splitTextByUtf8Bytes(text)
      setTotalChunks(chunks.length)
      await sendMessage("ttsPlaybackEnsureOffscreen")

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
          const playbackResult = await sendMessage("ttsPlaybackStart", {
            requestId,
            audioBase64: audioChunk.audioBase64,
            contentType: audioChunk.contentType,
          })
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
    },
    onError: (error) => {
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

  const play = (text: string, ttsConfig: TTSConfig) => {
    return playMutation.mutateAsync({ text, ttsConfig })
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
