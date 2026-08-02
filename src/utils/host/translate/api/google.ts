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

// The endpoint treats literal newlines as collapsible HTML whitespace, so
// multi-line plain text loses its line structure — no escape survives
// ("&#10;" collapses too). Reported on X tweets rendered under
// white-space: pre-wrap, where "\n" is the only line structure:
//   https://x.com/davidjpark96/status/1789773192435060737 (bullet lists
//   squashed onto one line) and
//   https://x.com/EpsteinJeffrey0/status/2083709421386080579 (five
//   single-"\n" lines merged into one run-on translation).
// Three further live-verified behaviors shape the preserveLineBreaks
// strategy:
//   - the endpoint natively accepts multiple texts per request
//     ([[[t1, t2, …], sl, tl], client]) and returns them in order;
//   - the model strips leading dash-family list bullets from translated
//     lines (even when each line is its own batch item);
//   - leading indentation collapses like any HTML whitespace.
// So when the caller signals semantic line breaks, each line becomes its own
// batch item, and per-line indentation plus bullet prefix are extracted
// before the request and reattached verbatim afterwards. The gating matters:
// only the content layer knows whether the source's white-space CSS (or an
// input box) makes newlines meaningful — ordinary pages wrap sentences
// across pretty-printed source lines and RELY on the collapsing (a forced
// per-line split would translate sentence fragments separately).
const LINE_SPLIT_REGEX = /\r\n?|\n/
const LINE_INDENT_REGEX = /^[ \t]*/
// A dash-family bullet must be followed by horizontal whitespace so negative
// numbers ("-5°C") and emphasis ("*bold*") never count as list markers.
const LINE_BULLET_REGEX = /^[-–—•·▪◦‣⁃*][ \t]+/
// Output-side normalization: whatever bullet/indentation the model emitted is
// replaced by the source line's own prefix, so the prefix survives verbatim
// whether the model kept, dropped, or restyled it.
const TRANSLATED_LINE_PREFIX_REGEX = /^[ \t]*(?:[-–—•·▪◦‣⁃*][ \t]+)?[ \t]*/

export interface PreservedLine {
  /** Indentation + bullet exactly as written; reattached verbatim. */
  prefix: string
  /**
   * The line minus indentation, bullet INCLUDED: an isolated bare token
   * translates measurably worse (live-observed: item "SEO" → "这", while
   * "- SEO" → "搜索引擎优化"), so the bullet stays in the request for
   * context and is normalized away from the response instead.
   */
  content: string
}

export function splitPreservedLines(text: string): PreservedLine[] {
  return text.split(LINE_SPLIT_REGEX).map((line) => {
    const indent = LINE_INDENT_REGEX.exec(line)?.[0] ?? ""
    const rest = line.slice(indent.length)
    const bullet = LINE_BULLET_REGEX.exec(rest)?.[0] ?? ""
    return { content: rest, prefix: indent + bullet }
  })
}

export function reassemblePreservedLine(line: PreservedLine, translation: string): string {
  return line.prefix + translation.replace(TRANSLATED_LINE_PREFIX_REGEX, "")
}

export async function googleTranslate(
  sourceText: string,
  fromLang: string,
  toLang: string,
  options?: {
    textFormat?: TranslationTextFormat
    /**
     * Caller-owned signal that the source's line breaks are semantic (the
     * source container preserves newlines, or the text is user-typed input).
     * Plain format only — html payloads carry their own structure. Known gap:
     * literal newlines inside html-format text nodes still collapse.
     */
    preserveLineBreaks?: boolean
    signal?: AbortSignal
  },
): Promise<string> {
  // translateHtml parses the request text as HTML, so plain source text must be
  // escaped (& < > nbsp) before sending, while html input (translationOnly page
  // mode) is sent as-is so the endpoint preserves its tags. The response stays
  // HTML-encoded and is decoded exactly once by normalizeTranslationOutput in
  // executeTranslate — line reassembly happens before that and only ever
  // concatenates response items with plain prefixes, so it cannot interfere.
  const preserveLineBreaks = options?.preserveLineBreaks === true && options?.textFormat !== "html"
  let preservedLines: PreservedLine[] | undefined
  let requestTexts: string[]
  if (options?.textFormat === "html") {
    requestTexts = [sourceText]
  } else if (!preserveLineBreaks) {
    requestTexts = [escapeText(sourceText)]
  } else {
    preservedLines = splitPreservedLines(sourceText)
    // The endpoint rejects empty batch items (400), so blank lines stay out
    // of the request and are restored positionally during reassembly.
    requestTexts = preservedLines
      .filter((line) => line.content !== "")
      .map((line) => escapeText(line.content))
    if (requestTexts.length === 0) {
      return sourceText
    }
  }
  const resp = await fetch(GOOGLE_TRANSLATE_HTML_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json+protobuf",
      "X-Goog-API-Key": GOOGLE_TRANSLATE_HTML_API_KEY,
    },
    body: JSON.stringify([[requestTexts, fromLang, toLang], GOOGLE_TRANSLATE_HTML_CLIENT]),
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

    if (
      !Array.isArray(result) ||
      !Array.isArray(result[0]) ||
      result[0].length !== requestTexts.length ||
      !result[0].every((item: unknown) => typeof item === "string")
    ) {
      throw new TypeError("Unexpected response format from translation API")
    }
    const translations: string[] = result[0]

    if (!preservedLines) {
      return translations[0]!
    }

    let translationIndex = 0
    return preservedLines
      .map((line) =>
        line.content === ""
          ? line.prefix
          : reassemblePreservedLine(line, translations[translationIndex++]!),
      )
      .join("\n")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse translation response: ${message}`, { cause: error })
  }
}
