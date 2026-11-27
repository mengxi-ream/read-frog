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
 * cannot play audio. Safari starts an AudioContext only within a few seconds
 * of the user's click (navigator.userActivation.isActive). Once started, it
 * resumes without a click, so the later chunks of a long text play too.
 * A running context keeps the Mac from sleeping even when it is silent, so the
 * context runs only while a chunk plays.
 * Decoded audio has no URL, so a page's CSP cannot block it the way it blocks
 * a blob: <audio>.
 *
 * One chunk plays at a time: a new play() stops the one before.
 */
export class WebAudioPlaybackController {
  private context: AudioContext | null = null
  // The resume() a click started. Safari never settles one it refused.
  private unlocking: Promise<void> | undefined
  // Whether that resume() has settled, so the context resumes without a click.
  private unlocked = false
  private run: PlaybackRun | null = null

  /**
   * Starts the context the first time the user clicks, which is when Safari
   * allows it (navigator.userActivation.isActive). Call it from the click
   * handler, before anything is awaited.
   */
  prepare(): AudioContext {
    const context = (this.context ??= new AudioContext())
    if (!this.unlocked && navigator.userActivation.isActive) {
      this.unlocking = context.resume().then(() => {
        this.unlocked = true
        this.suspendIfIdle()
      })
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
    this.suspendIfIdle()
  }

  private async start(run: PlaybackRun, context: AudioContext, audioBase64: string) {
    try {
      const buffer = await context.decodeAudioData(base64ToArrayBuffer(audioBase64))
      if (!this.unlocking) {
        throw new Error(PLAYBACK_BLOCKED_MESSAGE)
      }
      await this.unlocking
      // Stopped or replaced meanwhile: stop() has answered for it, and
      // resuming for it would leave the context running.
      if (this.run !== run) {
        return
      }
      // Safari runs suspend() and resume() in the order they are called, so a
      // stop() from here on still leaves the context suspended.
      await context.resume()
      if (this.run !== run) {
        return
      }

      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.onended = () => {
        if (this.run !== run) return
        this.run = null
        source.disconnect()
        run.resolve({ ok: true })
        this.suspendIfIdle()
      }
      run.source = source
      source.start()
    } catch (error) {
      if (this.run !== run) return
      this.run = null
      run.reject(error)
      this.suspendIfIdle()
    }
  }

  private suspendIfIdle() {
    if (this.unlocked && !this.run) {
      void this.context?.suspend()
    }
  }
}
