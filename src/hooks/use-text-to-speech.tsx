import type { TTSConfig } from '@/types/config/tts'
import { i18n } from '#imports'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { franc } from 'franc'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { sendMessage } from '@/utils/message'
import { splitTextByUtf8Bytes } from '@/utils/server/edge-tts/chunk'

interface PlayAudioParams {
  text: string
  ttsConfig: TTSConfig
}

const TTS_ERROR_TOAST_ID = 'tts-synthesize-error'

function toSignedValue(value: number, unit: '%' | 'Hz'): string {
  return `${value >= 0 ? '+' : ''}${value}${unit}`
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function resolveVoiceForText(text: string, ttsConfig: TTSConfig): string {
  const detectedLanguage = franc(text)

  if (detectedLanguage !== 'und' && detectedLanguage in ttsConfig.languageVoices) {
    return ttsConfig.languageVoices[detectedLanguage as keyof typeof ttsConfig.languageVoices] ?? ttsConfig.defaultVoice
  }

  return ttsConfig.defaultVoice
}

function getTTSFriendlyErrorDescription(error: Error): string | undefined {
  if (error.message.includes('Edge TTS returned empty audio data')) {
    return 'The current voice may not support this language. Try switching to a matching voice.'
  }

  if (error.message.includes('[SYNTH_RATE_LIMITED]')) {
    return 'Too many TTS requests. Please try again in a moment.'
  }

  if (error.message.includes('[NETWORK_ERROR]') || error.message.includes('[TOKEN_FETCH_FAILED]') || error.message.includes('[TOKEN_INVALID]')) {
    return 'Edge TTS is temporarily unavailable. Please check your network and retry.'
  }

  return error.message || undefined
}

async function synthesizeEdgeTTSAudioBlob(chunk: string, voice: string, ttsConfig: TTSConfig): Promise<Blob> {
  const response = await sendMessage('edgeTtsSynthesize', {
    text: chunk,
    voice,
    rate: toSignedValue(ttsConfig.rate, '%'),
    pitch: toSignedValue(ttsConfig.pitch, 'Hz'),
    volume: toSignedValue(ttsConfig.volume, '%'),
  })

  if (!response.ok) {
    throw new Error(`[${response.error.code}] ${response.error.message}`)
  }

  const audioBuffer = base64ToArrayBuffer(response.audioBase64)
  if (audioBuffer.byteLength === 0) {
    throw new Error('Edge TTS returned empty audio data')
  }

  return new Blob([audioBuffer], { type: response.contentType })
}

export function useTextToSpeech() {
  const queryClient = useQueryClient()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentChunk, setCurrentChunk] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const shouldStopRef = useRef(false)

  const stop = () => {
    shouldStopRef.current = true
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
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

      const selectedVoice = resolveVoiceForText(text, ttsConfig)
      const chunks = splitTextByUtf8Bytes(text)
      setTotalChunks(chunks.length)

      const fetchChunkBlob = async (chunk: string) => {
        return queryClient.fetchQuery({
          queryKey: ['tts-audio', { text: chunk, voice: selectedVoice, rate: ttsConfig.rate, pitch: ttsConfig.pitch, volume: ttsConfig.volume }],
          queryFn: () => synthesizeEdgeTTSAudioBlob(chunk, selectedVoice, ttsConfig),
          staleTime: Number.POSITIVE_INFINITY,
          gcTime: 1000 * 60 * 10,
          meta: {
            suppressToast: true,
          },
        })
      }

      const playBlob = async (blob: Blob) => {
        return new Promise<void>((resolve, reject) => {
          try {
            setIsPlaying(true)
            const audioUrl = URL.createObjectURL(blob)
            const audio = new Audio(audioUrl)
            audioRef.current = audio

            audio.onended = () => {
              URL.revokeObjectURL(audioUrl)
              setIsPlaying(false)
              audioRef.current = null
              resolve()
            }

            audio.onerror = () => {
              URL.revokeObjectURL(audioUrl)
              setIsPlaying(false)
              audioRef.current = null
              reject(new Error('Failed to play audio'))
            }

            audio.play().catch((error) => {
              URL.revokeObjectURL(audioUrl)
              setIsPlaying(false)
              audioRef.current = null
              reject(error)
            })
          }
          catch (error) {
            setIsPlaying(false)
            reject(error)
          }
        })
      }

      for (let index = 0; index < chunks.length; index++) {
        if (shouldStopRef.current) {
          break
        }

        setCurrentChunk(index + 1)
        const currentBlobPromise = fetchChunkBlob(chunks[index]!)
        const nextBlobPromise = index + 1 < chunks.length ? fetchChunkBlob(chunks[index + 1]!) : null
        const blob = await currentBlobPromise

        if (shouldStopRef.current) {
          break
        }

        await playBlob(blob)
        if (nextBlobPromise) {
          await nextBlobPromise
        }
      }

      setCurrentChunk(0)
      setTotalChunks(0)
    },
    onError: (error) => {
      toast.error(i18n.t('speak.failedToGenerateSpeech'), {
        id: TTS_ERROR_TOAST_ID,
        description: getTTSFriendlyErrorDescription(error),
      })
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
