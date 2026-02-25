import type { EdgeTTSResponse } from "./types"
import type { EdgeTTSSynthesizeRequest } from "@/types/edge-tts"
import {
  EDGE_TTS_MAX_RETRIES,
  EDGE_TTS_OUTPUT_FORMAT,
  EDGE_TTS_RETRY_BASE_DELAY_MS,
  EDGE_TTS_USER_AGENT,
} from "./constants"
import { clearEdgeTTSTokenCache, getEdgeTTSEndpointToken } from "./endpoint"
import { EdgeTTSError } from "./errors"
import { buildSSMLRequest } from "./ssml"

function toRetryDelay(attempt: number): number {
  const base = EDGE_TTS_RETRY_BASE_DELAY_MS * (attempt + 1)
  const jitter = Math.floor(Math.random() * 200)
  return base + jitter
}

async function wait(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

function concatArrayBuffers(chunks: ArrayBuffer[]): ArrayBuffer {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    result.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  }

  return result.buffer
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof EdgeTTSError) {
    return error.retryable
  }

  return error instanceof TypeError
}

function resolveOutputFormat(outputFormat?: string): string {
  const trimmed = outputFormat?.trim()
  if (!trimmed) {
    return EDGE_TTS_OUTPUT_FORMAT
  }
  return trimmed
}

function isConcatenationSafeOutputFormat(outputFormat: string): boolean {
  const normalized = outputFormat.toLowerCase()
  return normalized.includes("mp3") || normalized.startsWith("raw-")
}

function assertChunkConcatSupported(chunkRequests: EdgeTTSSynthesizeRequest[]): void {
  if (chunkRequests.length <= 1) {
    return
  }

  const requestedFormats = chunkRequests.map(chunkRequest => resolveOutputFormat(chunkRequest.outputFormat))
  const firstFormat = requestedFormats[0]!
  const firstFormatNormalized = firstFormat.toLowerCase()

  for (let index = 0; index < requestedFormats.length; index++) {
    const requestedFormat = requestedFormats[index]!
    const requestedFormatNormalized = requestedFormat.toLowerCase()

    if (!isConcatenationSafeOutputFormat(requestedFormat)) {
      throw new EdgeTTSError(
        "SYNTH_REQUEST_FAILED",
        `Output format "${requestedFormat}" is not safe for multi-chunk concatenation`,
      )
    }

    if (requestedFormatNormalized !== firstFormatNormalized) {
      throw new EdgeTTSError(
        "SYNTH_REQUEST_FAILED",
        `Mixed output formats are not supported for multi-chunk concatenation: "${firstFormat}" and "${requestedFormat}"`,
      )
    }
  }
}

async function synthesizeChunk(request: EdgeTTSSynthesizeRequest): Promise<EdgeTTSResponse> {
  const endpointInfo = await getEdgeTTSEndpointToken()
  const url = `https://${endpointInfo.endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": endpointInfo.endpoint.t,
      "Content-Type": "application/ssml+xml",
      "User-Agent": EDGE_TTS_USER_AGENT,
      "X-Microsoft-OutputFormat": resolveOutputFormat(request.outputFormat),
    },
    body: buildSSMLRequest(request),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")

    if (response.status === 401 || response.status === 403) {
      clearEdgeTTSTokenCache()
      throw new EdgeTTSError("TOKEN_INVALID", `Edge TTS token invalid: ${response.status} ${errorText}`, {
        status: response.status,
        retryable: true,
      })
    }

    if (response.status === 429) {
      throw new EdgeTTSError("SYNTH_RATE_LIMITED", `Edge TTS rate limited: ${errorText}`, {
        status: response.status,
        retryable: true,
      })
    }

    if (response.status >= 500) {
      throw new EdgeTTSError("SYNTH_SERVER_ERROR", `Edge TTS server error: ${response.status} ${errorText}`, {
        status: response.status,
        retryable: true,
      })
    }

    throw new EdgeTTSError("SYNTH_REQUEST_FAILED", `Edge TTS request failed: ${response.status} ${errorText}`, {
      status: response.status,
    })
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "audio/mpeg",
  }
}

export async function synthesizeEdgeTTSChunkWithRetry(
  request: EdgeTTSSynthesizeRequest,
): Promise<EdgeTTSResponse> {
  let lastError: unknown
  for (let attempt = 0; attempt <= EDGE_TTS_MAX_RETRIES; attempt++) {
    try {
      return await synthesizeChunk(request)
    }
    catch (error) {
      lastError = error
      if (attempt >= EDGE_TTS_MAX_RETRIES || !isRetryableError(error)) {
        break
      }
      await wait(toRetryDelay(attempt))
    }
  }

  if (lastError instanceof EdgeTTSError) {
    throw lastError
  }

  if (lastError instanceof TypeError) {
    throw new EdgeTTSError("NETWORK_ERROR", `Network error while requesting Edge TTS: ${lastError.message}`, {
      cause: lastError,
      retryable: true,
    })
  }

  throw new EdgeTTSError("UNKNOWN_ERROR", "Unknown Edge TTS synthesis error", {
    cause: lastError,
  })
}

export async function combineEdgeTTSAudioChunks(
  chunkRequests: EdgeTTSSynthesizeRequest[],
): Promise<EdgeTTSResponse> {
  assertChunkConcatSupported(chunkRequests)

  const chunkAudioBuffers: ArrayBuffer[] = []
  let contentType = "audio/mpeg"

  for (const chunkRequest of chunkRequests) {
    const response = await synthesizeEdgeTTSChunkWithRetry(chunkRequest)
    contentType = response.contentType
    chunkAudioBuffers.push(response.audio)
  }

  return {
    audio: concatArrayBuffers(chunkAudioBuffers),
    contentType,
  }
}
