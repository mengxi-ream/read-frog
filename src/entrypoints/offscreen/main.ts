import type { TTSPlaybackStartResponse, TTSPlaybackStopReason } from "@/types/tts-playback"
import { onMessage } from "@/utils/message"

interface ActivePlayback {
  requestId: string
  audio: HTMLAudioElement
  audioUrl: string
  settled: boolean
  resolve: (response: TTSPlaybackStartResponse) => void
  reject: (error: Error) => void
}

let activePlayback: ActivePlayback | null = null

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function cleanupPlayback(playback: ActivePlayback) {
  playback.audio.onended = null
  playback.audio.onerror = null
  playback.audio.pause()
  playback.audio.removeAttribute("src")
  playback.audio.load()
  URL.revokeObjectURL(playback.audioUrl)
}

function settlePlayback(playback: ActivePlayback, response: TTSPlaybackStartResponse): boolean {
  if (playback.settled) {
    return false
  }

  playback.settled = true
  cleanupPlayback(playback)
  if (activePlayback === playback) {
    activePlayback = null
  }
  playback.resolve(response)
  return true
}

function failPlayback(playback: ActivePlayback, error: Error): boolean {
  if (playback.settled) {
    return false
  }

  playback.settled = true
  cleanupPlayback(playback)
  if (activePlayback === playback) {
    activePlayback = null
  }
  playback.reject(error)
  return true
}

function stopActivePlayback(reason: TTSPlaybackStopReason, requestId?: string): boolean {
  const playback = activePlayback
  if (!playback) {
    return false
  }

  if (requestId && playback.requestId !== requestId) {
    return false
  }

  return settlePlayback(playback, { ok: false, reason })
}

onMessage("ttsOffscreenPlay", async (message) => {
  stopActivePlayback("interrupted")

  const { requestId, audioBase64, contentType } = message.data

  return new Promise<TTSPlaybackStartResponse>((resolve, reject) => {
    const bytes = base64ToUint8Array(audioBase64)
    const audioBuffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(audioBuffer).set(bytes)
    const blob = new Blob([audioBuffer], { type: contentType })
    const audioUrl = URL.createObjectURL(blob)
    const audio = new Audio(audioUrl)

    const playback: ActivePlayback = {
      requestId,
      audio,
      audioUrl,
      settled: false,
      resolve,
      reject,
    }

    activePlayback = playback

    audio.onended = () => {
      settlePlayback(playback, { ok: true })
    }

    audio.onerror = () => {
      failPlayback(playback, new Error("Failed to play audio in offscreen document"))
    }

    audio.play().catch((error) => {
      const normalizedError = error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unknown audio playback error")
      failPlayback(playback, normalizedError)
    })
  })
})

onMessage("ttsOffscreenStop", async (message) => {
  stopActivePlayback(message.data.reason ?? "stopped", message.data.requestId)
  return { ok: true as const }
})
