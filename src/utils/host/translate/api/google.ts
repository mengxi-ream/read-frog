import type { TranslationTextFormat } from "@/types/config/translate"
import { escapeText } from "entities"
import { attachRequestErrorMeta } from "@/utils/request/retry-policy"

const GOOGLE_TRANSLATE_HTML_URL = "https://translate-pa.googleapis.com/v1/translateHtml"
const GOOGLE_TRANSLATE_HTML_API_KEY = "AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520"
const GOOGLE_TRANSLATE_HTML_CLIENT = "wt_lib"

export async function googleTranslate(
  sourceText: string,
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat },
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
