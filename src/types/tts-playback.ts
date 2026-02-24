export type TTSPlaybackStopReason = "stopped" | "interrupted"

export interface TTSPlaybackStartRequest {
  requestId: string
  audioBase64: string
  contentType: string
}

export type TTSPlaybackStartResponse
  = | { ok: true }
    | { ok: false, reason: TTSPlaybackStopReason }

export interface TTSPlaybackStopRequest {
  requestId?: string
}

export interface TTSOffscreenStopRequest {
  requestId?: string
  reason?: TTSPlaybackStopReason
}
