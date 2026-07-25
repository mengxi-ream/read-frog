import type { TranslationTextFormat } from "@/types/config/translate"
import { escapeText } from "entities"
import { attachRequestErrorMeta } from "@/utils/request/retry-policy"

/**
 * Upper bound for the install-time reachability probe. Where Google is blocked the request
 * usually hangs instead of failing fast, so this is the delay users in those networks pay
 * once; keep it short enough not to stall extension startup.
 */
const GOOGLE_TRANSLATE_PROBE_TIMEOUT_MS = 3000

const GOOGLE_TRANSLATE_HTML_URL = "https://translate-pa.googleapis.com/v1/translateHtml"
const GOOGLE_TRANSLATE_HTML_API_KEY = "AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520"
const GOOGLE_TRANSLATE_HTML_CLIENT = "wt_lib"

/**
 * Probe whether this network can actually reach Google Translate, by running the smallest
 * possible real translation against the same endpoint the provider uses. Any failure —
 * DNS, TLS, timeout, non-2xx, unexpected payload — answers `false`; the caller is expected
 * to fall back to a provider that works everywhere.
 *
 * To exercise the blocked-network path locally, add one of these to `chromiumArgs` in
 * `web-ext.config.ts` (`pnpm dev` uses a fresh profile per run, so every start is an install):
 *   --host-resolver-rules=MAP translate-pa.googleapis.com ^NOTFOUND   → DNS fails fast
 *   --host-resolver-rules=MAP translate-pa.googleapis.com 203.0.113.1 → dropped, times out
 */
export async function isGoogleTranslateReachable(options?: {
  timeoutMs?: number
}): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? GOOGLE_TRANSLATE_PROBE_TIMEOUT_MS

  try {
    const translated = await googleTranslate("hello", "en", "zh", {
      signal: AbortSignal.timeout(timeoutMs),
    })
    return translated.trim().length > 0
  } catch {
    return false
  }
}

export async function googleTranslate(
  sourceText: string,
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string> {
  // translateHtml parses the request text as HTML, so plain source text must be
  // escaped (& < > nbsp) before sending, while html input (translationOnly page
  // mode) is sent as-is so the endpoint preserves its tags. The response stays
  // HTML-encoded and is decoded exactly once by normalizeTranslationOutput in
  // executeTranslate.
  //
  // Known issue: the endpoint also treats newlines as collapsible HTML whitespace,
  // so multi-line text loses its line structure (e.g. X tweet paragraphs separated
  // by literal "\n\n" under white-space: pre-wrap in translationOnly mode, or
  // multi-line input translation). No escape can protect "\n" ("&#10;" collapses
  // too). A future fix must inject <br> markers before sending and restore them
  // after (a lone <br> can be merged away by the sentence segmenter, a "\n\n" pair
  // never is) — gated by a content-layer signal, because only the content script
  // knows whether the container's white-space CSS makes newlines meaningful;
  // ordinary pages rely on this collapsing for pretty-printed source newlines.
  const requestText = options?.textFormat === "html" ? sourceText : escapeText(sourceText)
  const resp = await fetch(GOOGLE_TRANSLATE_HTML_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json+protobuf",
      "X-Goog-API-Key": GOOGLE_TRANSLATE_HTML_API_KEY,
    },
    body: JSON.stringify([[[requestText], fromLang, toLang], GOOGLE_TRANSLATE_HTML_CLIENT]),
    signal: options?.signal,
  }).catch((error) => {
    throw attachRequestErrorMeta(new Error(`Network error during translation: ${error.message}`), {
      kind: "network",
      isRetryable: true,
    })
  })

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "Unable to read error response")
    throw attachRequestErrorMeta(
      new Error(
        `Translation request failed: ${resp.status} ${resp.statusText}${
          errorText ? ` - ${errorText}` : ""
        }`,
      ),
      {
        statusCode: resp.status,
        responseHeaders: resp.headers,
      },
    )
  }

  try {
    const result = await resp.json()

    if (!Array.isArray(result) || !Array.isArray(result[0]) || typeof result[0][0] !== "string") {
      throw new TypeError("Unexpected response format from translation API")
    }

    return result[0][0]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse translation response: ${message}`, { cause: error })
  }
}
