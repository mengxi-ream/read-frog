import type {
  MiniMaxTTSErrorCode,
  MiniMaxTTSSynthesizeRequest,
  MiniMaxTTSSynthesizeResponse,
} from "@/types/minimax-tts"
import { MINIMAX_TTS_ENDPOINTS } from "@/types/minimax-tts"

interface MiniMaxTTSAPIResponse {
  data?: {
    audio?: string
    status?: number
  } | null
  base_resp?: {
    status_code?: number
    status_msg?: string
  }
}

class MiniMaxTTSError extends Error {
  code: MiniMaxTTSErrorCode
  retryable: boolean
  status?: number

  constructor(
    code: MiniMaxTTSErrorCode,
    message: string,
    options?: { retryable?: boolean; status?: number },
  ) {
    super(message)
    this.name = "MiniMaxTTSError"
    this.code = code
    this.retryable = options?.retryable ?? false
    this.status = options?.status
  }
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[\da-f]+$/i.test(hex)) {
    throw new MiniMaxTTSError("INVALID_RESPONSE", "The speech API returned invalid audio data")
  }

  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes.buffer
}

const CONTENT_TYPES: Record<MiniMaxTTSSynthesizeRequest["audioFormat"], string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  pcm: "audio/pcm",
}

function validateRequest(request: MiniMaxTTSSynthesizeRequest): void {
  if (!request.apiKey.trim()) {
    throw new MiniMaxTTSError("INVALID_CONFIG", "A MiniMax API key is required")
  }
  if (!request.voiceId.trim()) {
    throw new MiniMaxTTSError("INVALID_CONFIG", "A MiniMax voice ID is required")
  }
  if (!request.text.trim()) {
    throw new MiniMaxTTSError("INVALID_TEXT", "Text to speech input is empty")
  }
}

async function requestMiniMaxTTS(
  request: MiniMaxTTSSynthesizeRequest,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  validateRequest(request)

  const response = await fetch(MINIMAX_TTS_ENDPOINTS[request.region], {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      text: request.text,
      stream: false,
      language_boost: "auto",
      output_format: "hex",
      voice_setting: {
        voice_id: request.voiceId,
      },
      audio_setting: {
        format: request.audioFormat,
      },
    }),
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw new MiniMaxTTSError("RATE_LIMITED", "The speech API rate limit was reached", {
        retryable: true,
        status: response.status,
      })
    }
    if (response.status >= 500) {
      throw new MiniMaxTTSError("SERVER_ERROR", "The speech API is temporarily unavailable", {
        retryable: true,
        status: response.status,
      })
    }
    throw new MiniMaxTTSError("REQUEST_FAILED", "The speech API rejected the request", {
      status: response.status,
    })
  }

  const payload = (await response.json()) as MiniMaxTTSAPIResponse
  if (payload.base_resp?.status_code !== 0) {
    throw new MiniMaxTTSError(
      "REQUEST_FAILED",
      payload.base_resp?.status_msg || "The speech API rejected the request",
    )
  }
  if (payload.data?.status !== 2 || typeof payload.data.audio !== "string") {
    throw new MiniMaxTTSError("INVALID_RESPONSE", "The speech API returned no completed audio")
  }

  return {
    audio: hexToArrayBuffer(payload.data.audio),
    contentType: CONTENT_TYPES[request.audioFormat],
  }
}

export async function synthesizeMiniMaxTTS(
  request: MiniMaxTTSSynthesizeRequest,
): Promise<MiniMaxTTSSynthesizeResponse> {
  try {
    const result = await requestMiniMaxTTS(request)
    return { ok: true, ...result }
  } catch (error) {
    if (error instanceof MiniMaxTTSError) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          status: error.status,
        },
      }
    }
    if (error instanceof TypeError) {
      return {
        ok: false,
        error: {
          code: "NETWORK_ERROR",
          message: "The speech API could not be reached",
          retryable: true,
        },
      }
    }
    return {
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: "The speech API returned an invalid response",
      },
    }
  }
}
