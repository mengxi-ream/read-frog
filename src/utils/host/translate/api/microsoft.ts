import type { TranslationTextFormat } from "@/types/config/translate"
import { escapeText } from "entities"
import { attachRequestErrorMeta } from "@/utils/request/retry-policy"

// Unauthenticated successor to the api-edge.cognitive.microsofttranslator.com
// flow, whose token endpoint (edge.microsoft.com/translate/auth) was removed
// upstream in 2026-07. Body is a bare JSON string array — the server rejects
// the old [{ Text }] shape — and `from`/`to` are the only honored parameters
// (`textType` no longer exists; see the html guard below).
const MICROSOFT_TRANSLATE_URL = "https://edge.microsoft.com/translate/translatetext"

export async function microsoftTranslate(
  source: string,
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string>
export async function microsoftTranslate(
  source: string[],
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string[]>
export async function microsoftTranslate(
  source: string | string[],
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string | string[]> {
  const isSingle = typeof source === "string"
  const texts = isSingle ? [source] : source

  if (texts.length === 0) {
    return []
  }

  // The endpoint has no markup-aware mode: it corrupts attributed HTML in
  // target-language-specific ways (attribute names translated, quotes
  // typographically curled, tag names eaten), which no post-processing can
  // undo. Config gating keeps translationOnly page mode — the only html
  // caller — away from this provider; failing loudly here stops any residual
  // path from injecting corrupted markup via innerHTML.
  if (options?.textFormat === "html") {
    throw new Error("Microsoft translator does not support HTML fragments")
  }

  const effectiveFromLang = fromLang === "auto" ? "" : fromLang

  // The endpoint runs Microsoft's HTML tag aligner on every request, so a bare
  // "<" in page text fuses into a pseudo-tag ("a < b and c > d" comes back as
  // "<B和C> d"). Escape like google.ts does; escaped entities round-trip
  // verbatim and normalizeTranslationOutput decodes exactly once.
  const requestTexts = texts.map((text) => escapeText(text))

  const resp = await fetch(
    `${MICROSOFT_TRANSLATE_URL}?from=${encodeURIComponent(effectiveFromLang)}&to=${encodeURIComponent(toLang)}&isEnterpriseClient=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestTexts),
      signal: options?.signal,
    },
  ).catch((error) => {
    throw attachRequestErrorMeta(
      new Error(`Network error during Microsoft translation: ${error.message}`),
      { kind: "network", isRetryable: true },
    )
  })

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "Unable to read error response")
    throw attachRequestErrorMeta(
      new Error(
        `Microsoft translation request failed: ${resp.status} ${resp.statusText}${
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

    if (!Array.isArray(result) || result.length !== texts.length) {
      throw new Error(
        `Unexpected response format: expected ${texts.length} results, got ${Array.isArray(result) ? result.length : "non-array"}`,
      )
    }

    const translations = result.map(
      (item: { translations?: { text?: string }[] }, index: number) => {
        const text = item?.translations?.[0]?.text
        if (text === null || text === undefined) {
          throw new Error(`Missing translation for item at index ${index}`)
        }
        return text
      },
    )

    return isSingle ? translations[0]! : translations
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse Microsoft translation response: ${message}`, { cause: error })
  }
}
