import type { OpenAICompatibleTTSRequestConfig } from "@/types/openai-compatible-tts"

const OPENAI_COMPATIBLE_TTS_TIMEOUT_MS = 60_000
const MAX_ERROR_RESPONSE_LENGTH = 1_000

const CONTENT_TYPE_BY_FORMAT: Record<OpenAICompatibleTTSRequestConfig["responseFormat"], string> = {
  mp3: "audio/mpeg",
  opus: "audio/opus",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  pcm: "audio/pcm",
}

export function buildOpenAICompatibleTTSEndpoint(baseURL: string): URL {
  const endpoint = new URL(baseURL)
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new Error("Base URL must use http or https")
  }
  if (endpoint.username || endpoint.password) {
    throw new Error("Base URL must not contain credentials")
  }

  const pathname = endpoint.pathname.replace(/\/+$/, "")
  endpoint.pathname = pathname.endsWith("/audio/speech") ? pathname : `${pathname}/audio/speech`
  endpoint.search = ""
  endpoint.hash = ""
  return endpoint
}

export async function synthesizeOpenAICompatibleTTS(
  text: string,
  config: OpenAICompatibleTTSRequestConfig,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  if (!text.trim()) {
    throw new Error("Text to speech input is empty")
  }

  const endpoint = buildOpenAICompatibleTTSEndpoint(config.baseURL)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_COMPATIBLE_TTS_TIMEOUT_MS)

  try {
    const apiKey = config.apiKey.trim()
    const instructions = config.instructions.trim()
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        input: text,
        voice: config.voice,
        response_format: config.responseFormat,
        speed: config.speed,
        ...(instructions ? { instructions } : {}),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const responseText = (await response.text()).slice(0, MAX_ERROR_RESPONSE_LENGTH)
      const detail = responseText ? `: ${responseText}` : ""
      throw new OpenAICompatibleTTSHTTPError(
        response.status,
        `TTS API returned ${response.status} ${response.statusText}${detail}`,
      )
    }

    const audio = await response.arrayBuffer()
    if (audio.byteLength === 0) {
      throw new Error("TTS API returned empty audio data")
    }

    return {
      audio,
      contentType:
        response.headers.get("content-type") ?? CONTENT_TYPE_BY_FORMAT[config.responseFormat],
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export class OpenAICompatibleTTSHTTPError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "OpenAICompatibleTTSHTTPError"
  }
}
