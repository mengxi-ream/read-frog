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

const MAX_CHUNK_SIZE = 4096

/**
 * Split text into chunks that respect sentence boundaries
 * Each chunk will be <= maxSize characters
 * Supports multiple languages including CJK (Chinese, Japanese, Korean)
 */
function splitTextIntoChunks(text: string, maxSize: number = MAX_CHUNK_SIZE): string[] {
  if (text.length <= maxSize) {
    return [text]
  }

  const chunks: string[] = []
  // Split by sentence boundaries:
  // - Western: . ! ? with optional quotes/parentheses
  // - CJK: 。！？；
  // - Arabic: ؟ ۔
  // - Devanagari: । ॥
  // - Also split on newlines and paragraph breaks
  const sentencePattern = /[^.!?。！？；؟۔।॥\n]+[.!?。！？；؟۔।॥\n]+|[^.!?。！？；؟۔।॥\n]+$/g
  const sentences = text.match(sentencePattern) || [text]

  let currentChunk = ''

  for (const sentence of sentences) {
    // If a single sentence is longer than maxSize, split it by words
    if (sentence.length > maxSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }

      const words = sentence.split(/\s+/)
      for (const word of words) {
        const combined = currentChunk ? `${currentChunk} ${word}` : word
        if (combined.length > maxSize) {
          if (currentChunk) {
            chunks.push(currentChunk.trim())
          }
          currentChunk = word
        }
        else {
          currentChunk = combined
        }
      }
      continue
    }

    // If adding this sentence would exceed maxSize, start a new chunk
    const combined = currentChunk + sentence
    if (combined.length > maxSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = sentence
    }
    else {
      currentChunk = combined
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter(chunk => chunk.length > 0)
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
    mutationFn: async ({ text, ttsConfig, ttsProviderConfig }) => {
      // Stop any currently playing audio first
      stop()
      shouldStopRef.current = false

      // Split text into chunks
      const chunks = splitTextIntoChunks(text)
      setTotalChunks(chunks.length)

      // Helper to fetch a chunk's audio blob
      const fetchChunkBlob = async (chunk: string) => {
        return queryClient.fetchQuery({
          queryKey: ['tts-audio', { text: chunk, ttsConfig, ttsProviderConfig }],
          queryFn: async () => {
            const provider = await getTTSProviderById(ttsProviderConfig.id)

            const result = await generateSpeech({
              model: provider.speech(ttsConfig.model),
              text: chunk,
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
      }

      // Helper to play a blob
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
      }

      // Play each chunk sequentially with prefetching
      for (let i = 0; i < chunks.length; i++) {
        if (shouldStopRef.current) {
          break
        }

        setCurrentChunk(i + 1)

        // Fetch current chunk and prefetch next chunk in parallel
        const currentBlobPromise = fetchChunkBlob(chunks[i])
        const nextBlobPromise = i + 1 < chunks.length ? fetchChunkBlob(chunks[i + 1]) : null

        const blob = await currentBlobPromise

        if (shouldStopRef.current) {
          break
        }

        // Play current chunk while next chunk is being fetched
        await playBlob(blob)

        // Wait for next chunk to be ready (if it's still fetching)
        if (nextBlobPromise) {
          await nextBlobPromise
        }
      }

      setCurrentChunk(0)
      setTotalChunks(0)
    },
    onError: () => {
      setIsPlaying(false)
      setCurrentChunk(0)
      setTotalChunks(0)
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
    currentChunk,
    totalChunks,
    error: playMutation.error,
  }
}
