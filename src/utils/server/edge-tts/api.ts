/**
 * Edge TTS API 服务
 * 参考：docs/edge-tts 和 docs/tts 仓库
 */

import type { EdgeTTSRequestParams } from "./types"
import type { EdgeTTSHealthStatus, EdgeTTSSynthesizeRequest, EdgeTTSSynthesizeResponse } from "@/types/edge-tts"
import { assertEdgeTTSAvailable, isEdgeTTSBrowserSupported } from "./browser"
import { splitTextByUtf8Bytes } from "./chunk"
import {
  getEdgeTTSCircuitOpenUntil,
  isEdgeTTSCircuitOpen,
  recordEdgeTTSFailure,
  recordEdgeTTSSuccess,
} from "./circuit-breaker"
import { EDGE_TTS_HTTP_ENABLED, EDGE_TTS_MAX_CHUNK_BYTES, EDGE_TTS_MAX_CHUNKS } from "./constants"
import { getEdgeTTSEndpointToken } from "./endpoint"
import { EdgeTTSError, toEdgeTTSErrorPayload } from "./errors"
import { combineEdgeTTSAudioChunks } from "./synthesize"
import { filterEdgeTTSVoicesByLocale, listEdgeTTSVoices as listEdgeTTSVoicesRaw } from "./voices"

function toChunkRequests(params: EdgeTTSRequestParams): EdgeTTSSynthesizeRequest[] {
  const chunks = splitTextByUtf8Bytes(params.text, EDGE_TTS_MAX_CHUNK_BYTES, EDGE_TTS_MAX_CHUNKS)
  return chunks.map(chunk => ({
    text: chunk,
    voice: params.voice,
    rate: params.rate,
    pitch: params.pitch,
    volume: params.volume,
    outputFormat: params.outputFormat,
  }))
}

export async function synthesizeEdgeTTS(params: EdgeTTSRequestParams): Promise<EdgeTTSSynthesizeResponse> {
  try {
    assertEdgeTTSAvailable()

    if (isEdgeTTSCircuitOpen()) {
      throw new EdgeTTSError("CIRCUIT_OPEN", "Edge TTS service is temporarily unavailable due to repeated failures")
    }

    const requests = toChunkRequests(params)
    const response = await combineEdgeTTSAudioChunks(requests)
    recordEdgeTTSSuccess()

    return {
      ok: true,
      audio: response.audio,
      contentType: response.contentType,
    }
  }
  catch (error) {
    const payload = toEdgeTTSErrorPayload(error)
    if (!["INVALID_TEXT", "TEXT_TOO_LONG", "UNSUPPORTED_BROWSER", "FEATURE_DISABLED", "CIRCUIT_OPEN"].includes(payload.code)) {
      recordEdgeTTSFailure()
    }
    return {
      ok: false,
      error: payload,
    }
  }
}

export async function listEdgeTTSVoices() {
  assertEdgeTTSAvailable()
  return listEdgeTTSVoicesRaw()
}

export async function getEdgeTTSHealthStatus(): Promise<EdgeTTSHealthStatus> {
  const browserSupported = isEdgeTTSBrowserSupported()
  const featureEnabled = EDGE_TTS_HTTP_ENABLED
  const circuitOpen = isEdgeTTSCircuitOpen()
  const circuitOpenUntil = getEdgeTTSCircuitOpenUntil()
  const baseStatus: EdgeTTSHealthStatus = {
    provider: "edge-tts",
    available: false,
    browserSupported,
    featureEnabled,
    circuitOpen,
    circuitOpenUntil,
    checkedAt: Date.now(),
  }

  if (!featureEnabled) {
    return {
      ...baseStatus,
      reason: "feature-disabled",
    }
  }

  if (!browserSupported) {
    return {
      ...baseStatus,
      reason: "unsupported-browser",
      error: {
        code: "UNSUPPORTED_BROWSER",
        message: `Edge TTS is not supported in ${import.meta.env.BROWSER}`,
      },
    }
  }

  if (circuitOpen) {
    return {
      ...baseStatus,
      reason: "circuit-open",
      error: {
        code: "CIRCUIT_OPEN",
        message: "Edge TTS is temporarily unavailable because the circuit breaker is open",
      },
    }
  }

  try {
    await getEdgeTTSEndpointToken()
    return {
      ...baseStatus,
      available: true,
      reason: "ok",
    }
  }
  catch (error) {
    return {
      ...baseStatus,
      reason: "endpoint-failed",
      error: toEdgeTTSErrorPayload(error),
    }
  }
}

export { filterEdgeTTSVoicesByLocale }
