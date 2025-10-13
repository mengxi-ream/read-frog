import type { TTSProviderConfig } from '@/types/config/provider'
import type { TTSConfig } from '@/types/config/tts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { experimental_generateSpeech as generateSpeech } from 'ai'
import { useRef, useState } from 'react'
import { getTTSProviderById } from '@/utils/providers/model'

interface PlayAudioParams {
  text: string
  ttsConfig: TTSConfig
  ttsProviderConfig: TTSProviderConfig
}

export function useTextToSpeech() {
  const queryClient = useQueryClient()
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsPlaying(false)
  }

  const playMutation = useMutation<void, Error, PlayAudioParams>({
    mutationFn: async ({ text, ttsConfig, ttsProviderConfig }) => {
      // Stop any currently playing audio first
      stop()

      // Fetch audio using tanstack query cache
      const blob = await queryClient.fetchQuery({
        queryKey: ['tts-audio', { text, ttsConfig, ttsProviderConfig }],
        queryFn: async () => {
          const provider = await getTTSProviderById(ttsProviderConfig.id)

          const result = await generateSpeech({
            model: provider.speech(ttsConfig.model),
            text,
            voice: ttsConfig.voice,
            speed: ttsConfig.speed,
            outputFormat: 'wav',
          })

          return new Blob([result.audio.uint8Array], {
            type: result.audio.mediaType || 'audio/wav',
          })
        },
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: 1000 * 60 * 10,
      })

      // Play audio
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

          audio.play()
            .catch((err) => {
              URL.revokeObjectURL(audioUrl)
              setIsPlaying(false)
              audioRef.current = null
              reject(err)
            })
        }
        catch (err) {
          setIsPlaying(false)
          reject(err)
        }
      })
    },
    onError: () => {
      setIsPlaying(false)
    },
  })

  const play = (text: string, ttsConfig: TTSConfig, ttsProviderConfig: TTSProviderConfig) => {
    return playMutation.mutateAsync({ text, ttsConfig, ttsProviderConfig })
  }

  const isFetching = playMutation.isPending && !isPlaying

  return {
    play,
    stop,
    isFetching,
    isPlaying,
    error: playMutation.error,
  }
}
