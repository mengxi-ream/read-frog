import type {
  TTSPlaybackStartRequest,
  TTSPlaybackStartResponse,
  TTSPlaybackStopRequest,
} from "@/types/tts-playback"

export const PLAYBACK_BLOCKED_MESSAGE = "[PLAYBACK_BLOCKED] The browser blocked audio playback"

interface PlaybackRun {
  requestId: string
  resolve: (response: TTSPlaybackStartResponse) => void
  reject: (error: unknown) => void
  // Set once its audio has started.
  source?: AudioBufferSourceNode
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return buffer
}

/**
 * Plays synthesized speech in the document that asked for it, through Web Audio.
 *
 * For Safari, which has no offscreen document and whose extension background
 * cannot play audio. A page may start audio only within a few seconds of the
 * user's click (navigator.userActivation.isActive), but an AudioContext
 * started then keeps running, so the later chunks of a long text play too.
 * Decoded audio has no URL, so a page's CSP cannot block it the way it blocks
 * a blob: <audio>.
 *
 * One chunk plays at a time: a new play() stops the one before.
 */
export class WebAudioPlaybackController {
  private context: AudioContext | null = null
  // The resume() a click started. Safari never settles one it refused.
  private starting: Promise<void> | undefined
  private run: PlaybackRun | null = null

  /**
   * Starts the context if the user has just clicked, which is when Safari
   * allows it (navigator.userActivation.isActive). Call it from the click
   * handler, before anything is awaited.
   */
  prepare(): AudioContext {
    const context = (this.context ??= new AudioContext())
    if (context.state !== "running" && navigator.userActivation.isActive) {
      this.starting = context.resume()
    }
    return context
  }

  play(request: TTSPlaybackStartRequest): Promise<TTSPlaybackStartResponse> {
    this.stop({ reason: "interrupted" })
    const context = this.prepare()
    return new Promise<TTSPlaybackStartResponse>((resolve, reject) => {
      const run: PlaybackRun = { requestId: request.requestId, resolve, reject }
      this.run = run
      void this.start(run, context, request.audioBase64)
    })
  }

  stop({ requestId, reason = "stopped" }: TTSPlaybackStopRequest = {}): void {
    const run = this.run
    if (!run || (requestId && requestId !== run.requestId)) {
      return
    }
    this.run = null
    if (run.source) {
      run.source.onended = null
      run.source.stop()
      run.source.disconnect()
    }
    run.resolve({ ok: false, reason })
  }

  private async start(run: PlaybackRun, context: AudioContext, audioBase64: string) {
    try {
      const buffer = await context.decodeAudioData(base64ToArrayBuffer(audioBase64))
      if (context.state !== "running") {
        await this.starting
      }
      // Stopped or replaced while it decoded: stop() has answered for it.
      if (this.run !== run) {
        return
      }
      if (context.state !== "running") {
        throw new Error(PLAYBACK_BLOCKED_MESSAGE)
      }

      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.onended = () => {
        if (this.run !== run) return
        this.run = null
        source.disconnect()
        run.resolve({ ok: true })
      }
      run.source = source
      source.start()
    } catch (error) {
      if (this.run !== run) return
      this.run = null
      run.reject(error)
    }
  }
}
