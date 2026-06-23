import type {
  TTSPlaybackStartRequest,
  TTSPlaybackStartResponse,
  TTSPlaybackStopReason,
  TTSPlaybackStopRequest,
} from "@/types/tts-playback"

interface ActivePlayback {
  requestId: string
  audio: HTMLAudioElement
  audioUrl: string
  settled: boolean
  resolve: (response: TTSPlaybackStartResponse) => void
  reject: (error: Error) => void
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error
  }
  return new Error(typeof error === "string" ? error : fallbackMessage)
}

export class DOMAudioPlaybackController {
  private activePlayback: ActivePlayback | null = null

  constructor(private readonly playbackErrorMessage: string) {}

  play(request: TTSPlaybackStartRequest): Promise<TTSPlaybackStartResponse> {
    this.stop({ reason: "interrupted" })

    return new Promise<TTSPlaybackStartResponse>((resolve, reject) => {
      let playback: ActivePlayback | null = null

      try {
        const bytes = base64ToUint8Array(request.audioBase64)
        const audioBuffer = new ArrayBuffer(bytes.byteLength)
        new Uint8Array(audioBuffer).set(bytes)
        const blob = new Blob([audioBuffer], { type: request.contentType })
        const audioUrl = URL.createObjectURL(blob)
        const audio = new Audio(audioUrl)

        playback = {
          requestId: request.requestId,
          audio,
          audioUrl,
          settled: false,
          resolve,
          reject,
        }

        this.activePlayback = playback

        audio.onended = () => {
          this.settlePlayback(playback!, { ok: true })
        }

        audio.onerror = () => {
          this.failPlayback(playback!, new Error(this.playbackErrorMessage))
        }

        audio.play().catch((error) => {
          this.failPlayback(playback!, toError(error, "Unknown audio playback error"))
        })
      }
      catch (error) {
        if (playback) {
          this.failPlayback(playback, toError(error, this.playbackErrorMessage))
          return
        }
        reject(toError(error, this.playbackErrorMessage))
      }
    })
  }

  stop(request: TTSPlaybackStopRequest = {}): boolean {
    return this.stopActivePlayback(request.reason ?? "stopped", request.requestId)
  }

  private cleanupPlayback(playback: ActivePlayback) {
    playback.audio.onended = null
    playback.audio.onerror = null
    playback.audio.pause()
    playback.audio.removeAttribute("src")
    playback.audio.load()
    URL.revokeObjectURL(playback.audioUrl)
  }

  private settlePlayback(playback: ActivePlayback, response: TTSPlaybackStartResponse): boolean {
    if (playback.settled) {
      return false
    }

    playback.settled = true
    this.cleanupPlayback(playback)
    if (this.activePlayback === playback) {
      this.activePlayback = null
    }
    playback.resolve(response)
    return true
  }

  private failPlayback(playback: ActivePlayback, error: Error): boolean {
    if (playback.settled) {
      return false
    }

    playback.settled = true
    this.cleanupPlayback(playback)
    if (this.activePlayback === playback) {
      this.activePlayback = null
    }
    playback.reject(error)
    return true
  }

  private stopActivePlayback(reason: TTSPlaybackStopReason, requestId?: string): boolean {
    const playback = this.activePlayback
    if (!playback) {
      return false
    }

    if (requestId && playback.requestId !== requestId) {
      return false
    }

    return this.settlePlayback(playback, { ok: false, reason })
  }
}
