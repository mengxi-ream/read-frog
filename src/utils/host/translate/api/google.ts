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
// Live-verified behaviors that shape the preserveLineBreaks strategy:
//   - <br> marker tags survive translation; a lone <br> can be merged away
//     by the sentence segmenter, but a marker PAIR never is, and the data
//     attribute keeps decoding unambiguous (escaped source text mentioning
//     "<br>" travels as entities and can never collide);
//   - the model strips leading dash-family list bullets from translated
//     lines, and leading indentation collapses like any HTML whitespace —
//     both are restored client-side from the source lines;
//   - CRITICALLY, the text must stay ONE request item: the endpoint
//     language-detects each item independently, and a short line misreads
//     ("- SEO" alone with sl=auto → "- 这"), while inside the whole unit the
//     same line translates correctly. Whole-unit transport keeps sl=auto
//     working on mixed-language pages with zero language forcing.
// The gating matters: only the content layer knows whether the source's
// white-space CSS (or an input box) makes newlines meaningful — ordinary
// pages wrap sentences across pretty-printed source lines and RELY on the
// collapsing.
const GOOGLE_LINE_BREAK_MARKER = '<br data-read-frog-lb="1">'
const GOOGLE_LINE_BREAK_MARKER_PAIR = GOOGLE_LINE_BREAK_MARKER.repeat(2)
// Tolerates self-closing serialization and translation-inserted horizontal
// whitespace around markers (the sentence joiner adds spaces; they are
// artifacts, not content, so they fold into the restored line boundary).
const GOOGLE_LINE_BREAK_MARKER_UNIT = String.raw`<br data-read-frog-lb="1"\s*/?>`
const GOOGLE_LINE_BREAK_MARKER_PAIR_PATTERN = String.raw`[^\S\r\n]*(?:${GOOGLE_LINE_BREAK_MARKER_UNIT}[^\S\r\n]*){2}`
const GOOGLE_LINE_BREAK_MARKER_PAIR_SPLIT_REGEX = new RegExp(GOOGLE_LINE_BREAK_MARKER_PAIR_PATTERN)
const GOOGLE_LINE_BREAK_MARKER_PAIR_GLOBAL_REGEX = new RegExp(
  GOOGLE_LINE_BREAK_MARKER_PAIR_PATTERN,
  "g",
)
const GOOGLE_LINE_BREAK_MARKER_SINGLE_REGEX = new RegExp(
  String.raw`[^\S\r\n]*${GOOGLE_LINE_BREAK_MARKER_UNIT}[^\S\r\n]*`,
  "g",
)
const LINE_SPLIT_REGEX = /\r\n?|\n/
const LINE_INDENT_REGEX = /^[ \t]*/
// A dash-family bullet must be followed by horizontal whitespace so negative
// numbers ("-5°C") and emphasis ("*bold*") never count as list markers.
const LINE_BULLET_REGEX = /^[-–—•·▪◦‣⁃*][ \t]+/
// Output-side normalization: whatever bullet/indentation the model emitted is
// replaced by the source line's own prefix, so the prefix survives verbatim
// whether the model kept, dropped, or restyled it. End-of-string counts as a
// bullet terminator so a bullet-only line ("- " → model returns "-") is
// normalized instead of doubling its dash.
const TRANSLATED_LINE_PREFIX_REGEX = /^[ \t]*(?:[-–—•·▪◦‣⁃*](?:[ \t]+|$))?[ \t]*/

export interface PreservedLine {
  /** Indentation + bullet exactly as written; reattached verbatim. */
  prefix: string
  /**
   * The line minus indentation, bullet INCLUDED: the bullet stays in the
   * request for context and is normalized away from the response instead
   * (the model may keep, drop, or restyle it).
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
  let requestText: string
  if (options?.textFormat === "html") {
    requestText = sourceText
  } else if (!preserveLineBreaks) {
    requestText = escapeText(sourceText)
  } else {
    // ONE item joined by marker pairs — never per-line items, so the
    // endpoint detects the language of the whole unit (see notes above).
    // Blank lines become adjacent pairs and survive verbatim.
    preservedLines = splitPreservedLines(sourceText)
    requestText = preservedLines
      .map((line) => escapeText(line.content))
      .join(GOOGLE_LINE_BREAK_MARKER_PAIR)
  }
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
    const translatedText: string = result[0][0]

    if (!preservedLines) {
      return translatedText
    }

    const segments = translatedText.split(GOOGLE_LINE_BREAK_MARKER_PAIR_SPLIT_REGEX)
    if (segments.length === preservedLines.length) {
      return preservedLines
        .map((line, index) =>
          line.content === ""
            ? line.prefix
            : reassemblePreservedLine(
                line,
                // A stray unpaired marker inside a segment must never leak
                // markup into the rendered translation.
                segments[index]!.replace(GOOGLE_LINE_BREAK_MARKER_SINGLE_REGEX, " "),
              ),
        )
        .join("\n")
    }

    // Segment drift (a pair merged or duplicated by the model — never seen in
    // sampling, but the failure must degrade gracefully): keep the line
    // structure by folding markers into newlines and skip prefix restoration.
    return translatedText
      .replace(GOOGLE_LINE_BREAK_MARKER_PAIR_GLOBAL_REGEX, "\n")
      .replace(GOOGLE_LINE_BREAK_MARKER_SINGLE_REGEX, "\n")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse translation response: ${message}`, { cause: error })
  }
}
