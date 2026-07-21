import type { LangCodeISO6391 } from "@read-frog/definitions"
import type { ProviderConfig } from "@/types/config/provider"
import type { TranslationTextFormat } from "@/types/config/translate"

type DeepLProviderConfig = Extract<ProviderConfig, { provider: "deepl" }>

interface DeepLLanguagePair {
  source?: string
  target: string
}

/**
 * Per-provider round-robin indices for multi-key load balancing.
 * A shared counter would let a one-key DeepL provider reset the sequence for a multi-key pool.
 */
const deeplKeyRoundRobinIndexByProviderId = new Map<string, number>()

/** Parse newline-separated DeepL API keys; empty lines are ignored. */
export function parseDeepLApiKeys(apiKey?: string): string[] {
  if (!apiKey) return []
  return apiKey
    .split(/\r?\n/)
    .map((key) => key.trim())
    .filter(Boolean)
}

/** Join non-empty keys for storage in the single `apiKey` string field. */
export function serializeDeepLApiKeys(keys: string[]): string {
  return keys
    .map((key) => key.trim())
    .filter(Boolean)
    .join("\n")
}

/** Pick the next key in round-robin order for the given provider pool. Throws if empty. */
export function pickNextDeepLApiKey(keys: string[], providerId: string): string {
  if (keys.length === 0) {
    throw new Error("DeepL API key is not configured")
  }
  const current = deeplKeyRoundRobinIndexByProviderId.get(providerId) ?? 0
  const index = current % keys.length
  deeplKeyRoundRobinIndexByProviderId.set(providerId, (current + 1) % keys.length)
  const key = keys[index]
  if (key === undefined) {
    throw new Error("DeepL API key is not configured")
  }
  return key
}

/** Test-only helper to keep round-robin order deterministic across cases. */
export function resetDeepLKeyRoundRobinIndex(): void {
  deeplKeyRoundRobinIndexByProviderId.clear()
}

export async function deeplTranslate(
  sourceText: string,
  fromLang: LangCodeISO6391 | "auto",
  toLang: LangCodeISO6391,
  providerConfig: DeepLProviderConfig,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string> {
  const [translatedText] = await requestDeepLTranslations(
    [sourceText],
    fromLang,
    toLang,
    providerConfig,
    options,
  )

  if (translatedText === undefined) {
    throw new Error("DeepL translation response did not include a result")
  }

  return translatedText
}

async function requestDeepLTranslations(
  sourceTexts: string[],
  fromLang: LangCodeISO6391 | "auto",
  toLang: LangCodeISO6391,
  providerConfig: DeepLProviderConfig,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string[]> {
  const apiKey = pickNextDeepLApiKey(parseDeepLApiKeys(providerConfig.apiKey), providerConfig.id)
  const baseURL = getDeepLBaseURL(apiKey)
  const url = `${baseURL}/v2/translate`
  const normalizedLanguages = normalizeDeepLLanguages(fromLang, toLang)

  const requestBody = JSON.stringify({
    text: sourceTexts,
    ...(normalizedLanguages.source ? { source_lang: normalizedLanguages.source } : {}),
    target_lang: normalizedLanguages.target,
    ...(options?.textFormat === "html" ? { tag_handling: "html" } : {}),
  })

  const fetchResponse = await fetchDirect(url, apiKey, requestBody, options?.signal)

  return await parseDeepLResponse(fetchResponse, sourceTexts.length)
}

async function fetchDirect(
  url: string,
  apiKey: string,
  body: string,
  signal?: AbortSignal,
): Promise<Response> {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
    signal,
  }).catch((error) => {
    throw new Error(`Network error during DeepL translation: ${error.message}`)
  })

  return resp
}

async function parseDeepLResponse(resp: Response, expectedCount: number): Promise<string[]> {
  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "Unable to read error response")
    throw new Error(
      `DeepL translation request failed: ${resp.status} ${resp.statusText}${errorText ? ` - ${errorText}` : ""}`,
    )
  }

  try {
    const result = await resp.json()
    const translations = (result as { translations?: Array<{ text?: unknown }> })?.translations

    if (!Array.isArray(translations)) {
      throw new TypeError("Unexpected response format from DeepL translation API")
    }

    if (translations.length !== expectedCount) {
      throw new RangeError(
        `DeepL translation response count mismatch: expected ${expectedCount}, got ${translations.length}`,
      )
    }

    return translations.map((translation, index) => {
      if (typeof translation?.text !== "string") {
        throw new TypeError(`Unexpected translation format at index ${index}`)
      }
      return translation.text
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse DeepL translation response: ${message}`, { cause: error })
  }
}

export function getDeepLBaseURL(apiKey: string): string {
  return apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com"
}

export function normalizeDeepLLanguages(
  fromLang: LangCodeISO6391 | "auto",
  toLang: LangCodeISO6391,
): DeepLLanguagePair {
  return {
    source: fromLang === "auto" ? undefined : formatDeepLLanguageCode(fromLang, "source"),
    target: formatDeepLLanguageCode(toLang, "target"),
  }
}

function formatDeepLLanguageCode(lang: LangCodeISO6391, direction: "source" | "target"): string {
  const formattedLang = lang.toUpperCase()

  if (formattedLang === "ZH") {
    return direction === "target" ? "ZH-HANS" : "ZH"
  }

  if (formattedLang === "ZH-TW") {
    return direction === "target" ? "ZH-HANT" : "ZH"
  }

  return formattedLang
}
