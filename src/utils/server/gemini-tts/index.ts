import type {
  GeminiTTSErrorCode,
  GeminiTTSFailure,
  GeminiTTSListVoicesRequest,
  GeminiTTSListVoicesResponse,
  GeminiTTSSynthesizeRequest,
  GeminiTTSSynthesizeResponse,
  GeminiTTSVoice,
  GeminiTTSVoiceGender,
  GeminiTTSVoicePitch,
  GoogleProviderConfig,
} from "@/types/gemini-tts"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { APICallError, generateSpeech, NoSpeechGeneratedError, RetryError } from "ai"
import { PROVIDER_URL_PLACEHOLDERS } from "@/utils/constants/providers"
import { getProviderHeadersWithOverride } from "@/utils/providers/headers"

const GEMINI_API_DEFAULT_BASE_URL = PROVIDER_URL_PLACEHOLDERS.google!
const VOICES_PAGE_SIZE = 1000
// The library holds about two thousand voices; the cap only stops a server that never ends paging.
const MAX_VOICES_PAGES = 10

interface GeminiVoiceEntry {
  id?: string
  display_name?: string
  language_code?: string
  accent?: string
  persona?: string
  gender?: string
  pitch?: string
  description?: string
}

interface GeminiListVoicesResponseBody {
  voices?: GeminiVoiceEntry[]
  next_page_token?: string
  nextPageToken?: string
  error?: { message?: string }
}

function failure(code: GeminiTTSErrorCode, message: string, status?: number): GeminiTTSFailure {
  return { ok: false, error: { code, message, status } }
}

function getStatusErrorCode(status: number): GeminiTTSErrorCode {
  if (status === 429) {
    return "RATE_LIMITED"
  }
  return status >= 500 ? "SERVER_ERROR" : "REQUEST_REJECTED"
}

/** The key, base URL and headers every request through this provider goes out with. */
function getConnection(providerConfig: GoogleProviderConfig) {
  return {
    apiKey: providerConfig.apiKey?.trim() ?? "",
    baseURL: providerConfig.baseURL?.trim() || undefined,
    headers: getProviderHeadersWithOverride(providerConfig.provider, providerConfig.headers),
  }
}

/**
 * Gemini 2.5 and 3.1 TTS read directions from the prompt. Later models read `text` strictly as a
 * transcript and take the delivery as speech metadata, which the AI SDK sends for `instructions`
 * (the same split as its GoogleSpeechModel).
 */
function readsDirectionsFromPrompt(model: string): boolean {
  return model.startsWith("gemini-2.5-") || model.startsWith("gemini-3.1-")
}

/**
 * The prompt for models that read directions from it. Marking the notes and the transcript apart
 * keeps the model from reading the notes aloud, which a bare "Say cheerfully: ..." prefix does not.
 */
export function buildGeminiTTSPrompt(text: string, style: string): string {
  const trimmedStyle = style.trim()
  if (!trimmedStyle) {
    return text
  }
  return `### DIRECTOR'S NOTES\nStyle: ${trimmedStyle}\n\n### TRANSCRIPT\n${text}`
}

function toFailure(error: unknown): GeminiTTSFailure {
  // Retries that ran out keep the provider's own error.
  const cause = RetryError.isInstance(error) ? error.lastError : error
  if (NoSpeechGeneratedError.isInstance(cause)) {
    return failure("EMPTY_AUDIO", "Gemini TTS returned empty audio data")
  }
  if (APICallError.isInstance(cause)) {
    const { statusCode } = cause
    if (statusCode === undefined) {
      return failure("NETWORK_ERROR", cause.message)
    }
    // A gateway's own error body is not Google's, and leaves the SDK no message to report.
    const message = cause.message || `Gemini TTS request failed (${statusCode})`
    return failure(getStatusErrorCode(statusCode), message, statusCode)
  }
  const message = cause instanceof Error ? cause.message : String(cause)
  // The browser's own fetch failure ("Failed to fetch") arrives unwrapped.
  return failure(cause instanceof TypeError ? "NETWORK_ERROR" : "REQUEST_REJECTED", message)
}

export async function synthesizeGeminiTTS(
  request: GeminiTTSSynthesizeRequest,
): Promise<GeminiTTSSynthesizeResponse> {
  const text = request.text.trim()
  if (!text) {
    return failure("INVALID_TEXT", "Text is empty")
  }
  const { apiKey, baseURL, headers } = getConnection(request.providerConfig)
  if (!apiKey) {
    return failure("MISSING_API_KEY", "Gemini API key is not set")
  }

  const style = request.style.trim()
  const directionsInPrompt = readsDirectionsFromPrompt(request.model)
  try {
    const google = createGoogleGenerativeAI({
      apiKey,
      ...(baseURL && { baseURL }),
      ...(headers && { headers }),
    })
    // Wraps bare PCM in a WAV header, and retries a rate limit or a server error twice.
    const { audio } = await generateSpeech({
      model: google.speech(request.model),
      text: directionsInPrompt ? buildGeminiTTSPrompt(text, style) : text,
      voice: request.voice,
      ...(!directionsInPrompt && style && { instructions: style }),
    })
    return { ok: true, audioBase64: audio.base64, contentType: audio.mediaType }
  } catch (error) {
    return toFailure(error)
  }
}

function toGender(gender: string | undefined): GeminiTTSVoiceGender {
  return gender === "female" || gender === "male" ? gender : "neutral"
}

function toPitch(pitch: string | undefined): GeminiTTSVoicePitch {
  return pitch === "low" || pitch === "high" ? pitch : "medium"
}

/**
 * "Storyteller & Narrator (Nature Documentary Narrator)" and "Customer Support Agent / Call
 * Center Agent (Social Worker)" both name a broad persona first; that part is what voices group by.
 */
export function toUseCase(persona: string | undefined): string {
  return persona?.split(" / ")[0]?.split(" (")[0]?.trim() || "Other"
}

function isCustomVoiceId(id: string): boolean {
  return id.startsWith("voice_") || id.startsWith("voicekey_")
}

function toGeminiTTSVoice(entry: GeminiVoiceEntry): GeminiTTSVoice | null {
  // The caller's own custom voices lead the list, but they cannot be spoken as a prebuilt voice
  // name (the AI SDK refuses them the same way), so only the system voices are offered.
  if (!entry.id || isCustomVoiceId(entry.id)) {
    return null
  }
  return {
    voice: entry.id,
    name: entry.display_name || entry.id,
    languageCode: entry.language_code ?? "",
    accent: entry.accent ?? "",
    useCase: toUseCase(entry.persona),
    description: entry.description ?? "",
    gender: toGender(entry.gender),
    pitch: toPitch(entry.pitch),
  }
}

export async function listGeminiTTSVoices(
  request: GeminiTTSListVoicesRequest,
): Promise<GeminiTTSListVoicesResponse> {
  const { apiKey, baseURL, headers } = getConnection(request.providerConfig)
  if (!apiKey) {
    return failure("MISSING_API_KEY", "Gemini API key is not set")
  }

  const voices: GeminiTTSVoice[] = []
  let pageToken = ""
  for (let page = 0; page < MAX_VOICES_PAGES; page++) {
    let response: Response
    try {
      const url = new URL(`${(baseURL ?? GEMINI_API_DEFAULT_BASE_URL).replace(/\/+$/, "")}/voices`)
      url.searchParams.set("pageSize", String(VOICES_PAGE_SIZE))
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken)
      }
      // The key first and the provider's own headers after it, the order the AI SDK sends them in.
      response = await fetch(url, { headers: { "x-goog-api-key": apiKey, ...headers } })
    } catch (error) {
      return failure("NETWORK_ERROR", error instanceof Error ? error.message : String(error))
    }

    const body = (await response.json().catch(() => null)) as GeminiListVoicesResponseBody | null
    if (!response.ok) {
      const message = body?.error?.message ?? `Gemini voices request failed (${response.status})`
      return failure(getStatusErrorCode(response.status), message, response.status)
    }

    for (const entry of body?.voices ?? []) {
      const voice = toGeminiTTSVoice(entry)
      if (voice) {
        voices.push(voice)
      }
    }

    pageToken = body?.next_page_token || body?.nextPageToken || ""
    if (!pageToken) {
      break
    }
  }

  return { ok: true, voices }
}
