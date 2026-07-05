export type TTSPlaybackStopReason = "stopped" | "interrupted"

export interface TTSPlaybackStartRequest {
  requestId: string
  audioBase64: string
  contentType: string
  /**
   * Optional real-time stretch factor applied to the audio element (1 = natural
   * speed). Used to fit TTS audio into a subtitle time window without
   * re-synthesizing. When set, `preservesPitch` is enabled so the voice doesn't
   * shift pitch at faster/slower speeds.
   */
  playbackRate?: number
}

export type TTSPlaybackStartResponse
  = | { ok: true }
    | { ok: false, reason: TTSPlaybackStopReason }

export interface TTSPlaybackStopRequest {
  requestId?: string
  reason?: TTSPlaybackStopReason
}
