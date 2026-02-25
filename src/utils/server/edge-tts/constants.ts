function getRuntimeEnv(name: string): string | undefined {
  const value = import.meta.env[name]
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const EDGE_TTS_DEFAULT_TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
// Public Edge TTS signing material used by first-party clients. Runtime env can override it.
export const EDGE_TTS_DEFAULT_SIGNATURE_SECRET_BASE64
  = "oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw=="

export function getEdgeTTSTrustedClientToken(): string {
  return getRuntimeEnv("WXT_EDGE_TTS_TRUSTED_CLIENT_TOKEN") ?? EDGE_TTS_DEFAULT_TRUSTED_CLIENT_TOKEN
}

export function getEdgeTTSSignatureSecretBase64(): string {
  return getRuntimeEnv("WXT_EDGE_TTS_SIGNATURE_SECRET_BASE64") ?? EDGE_TTS_DEFAULT_SIGNATURE_SECRET_BASE64
}

export const EDGE_TTS_SIGNATURE_APP_ID
  = getRuntimeEnv("WXT_EDGE_TTS_SIGNATURE_APP_ID")
    ?? "MSTranslatorAndroidApp"

export const EDGE_TTS_ENDPOINT_URL = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0"

export function getEdgeTTSVoicesUrl(): string {
  return `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${getEdgeTTSTrustedClientToken()}`
}

export const EDGE_TTS_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"

export const EDGE_TTS_TOKEN_REFRESH_BEFORE_EXPIRY_MS = 3 * 60 * 1000
export const EDGE_TTS_DEFAULT_TOKEN_TTL_MS = 10 * 60 * 1000
export const EDGE_TTS_VOICES_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export const EDGE_TTS_MAX_CHUNK_BYTES = 1800
export const EDGE_TTS_MAX_CHUNKS = 60

export const EDGE_TTS_RETRY_BASE_DELAY_MS = 500
export const EDGE_TTS_MAX_RETRIES = 2

export const EDGE_TTS_CIRCUIT_WINDOW_MS = 10 * 60 * 1000
export const EDGE_TTS_CIRCUIT_FAILURE_THRESHOLD = 5
export const EDGE_TTS_CIRCUIT_OPEN_MS = 15 * 60 * 1000

export const EDGE_TTS_CLIENT_VERSION = "4.0.530a 5fe1dc6c"
export const EDGE_TTS_USER_ID = "0f04d16a175c411e"
export const EDGE_TTS_HOME_REGION = "zh-Hans-CN"

export const EDGE_TTS_USER_AGENT
  = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0"

export const EDGE_TTS_HTTP_ENABLED = import.meta.env.WXT_EDGE_TTS_HTTP_ENABLED !== "false"

export const EDGE_TTS_SUPPORTED_BROWSERS = ["chrome", "edge"] as const
