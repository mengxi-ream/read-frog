import type { LangCodeISO6391 } from "@read-frog/definitions"
import type { PureAPIProviderConfig } from "@/types/config/provider"
import { sendMessage } from "@/utils/message"

interface DeepLFetchResponse {
  ok: boolean
  status: number
  statusText: string
  text: () => Promise<string>
  json: () => Promise<unknown>
}

interface DeepLLanguagePair {
  source?: string
  target: string
}

const DEEPL_MAX_TEXTS_PER_REQUEST = 50

export async function deeplTranslate(
  sourceText: string,
  fromLang: LangCodeISO6391 | "auto",
  toLang: LangCodeISO6391,
  providerConfig: PureAPIProviderConfig,
  options?: { forceBackgroundFetch?: boolean },
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

export async function deeplTranslateBatch(
  sourceTexts: string[],
  fromLang: LangCodeISO6391 | "auto",
  toLang: LangCodeISO6391,
  providerConfig: PureAPIProviderConfig,
  options?: { forceBackgroundFetch?: boolean },
): Promise<string[]> {
  if (sourceTexts.length === 0) {
    return []
  }

  if (sourceTexts.length <= DEEPL_MAX_TEXTS_PER_REQUEST) {
    return await requestDeepLTranslations(
      sourceTexts,
      fromLang,
      toLang,
      providerConfig,
      options,
    )
  }

  const results: string[] = []
  for (let index = 0; index < sourceTexts.length; index += DEEPL_MAX_TEXTS_PER_REQUEST) {
    const chunk = sourceTexts.slice(index, index + DEEPL_MAX_TEXTS_PER_REQUEST)
    const chunkResults = await requestDeepLTranslations(
      chunk,
      fromLang,
      toLang,
      providerConfig,
      options,
    )
    results.push(...chunkResults)
  }

  return results
}

async function requestDeepLTranslations(
  sourceTexts: string[],
  fromLang: LangCodeISO6391 | "auto",
  toLang: LangCodeISO6391,
  providerConfig: PureAPIProviderConfig,
  options?: { forceBackgroundFetch?: boolean },
): Promise<string[]> {
  const apiKey = providerConfig.apiKey?.trim()
  if (!apiKey) {
    throw new Error("DeepL API key is not configured")
  }

  const baseURL = getDeepLBaseURL(apiKey, providerConfig.baseURL)
  const url = `${baseURL}/v2/translate`
  const normalizedLanguages = normalizeDeepLLanguages(fromLang, toLang)

  const requestBody = JSON.stringify({
    text: sourceTexts,
    ...(normalizedLanguages.source ? { source_lang: normalizedLanguages.source } : {}),
    target_lang: normalizedLanguages.target,
  })

  const fetchResponse = shouldUseBackgroundFetch(options)
    ? await fetchViaBackground(url, apiKey, requestBody)
    : await fetchDirect(url, apiKey, requestBody)

  return await parseDeepLResponse(fetchResponse, sourceTexts.length)
}

function shouldUseBackgroundFetch(options?: { forceBackgroundFetch?: boolean }): boolean {
  return options?.forceBackgroundFetch ?? typeof window !== "undefined"
}

async function fetchViaBackground(url: string, apiKey: string, body: string): Promise<DeepLFetchResponse> {
  const resp = await sendMessage("backgroundFetch", {
    url,
    method: "POST",
    headers: [
      ["Authorization", `DeepL-Auth-Key ${apiKey}`],
      ["Content-Type", "application/json"],
    ],
    body,
    credentials: "omit",
  })

  return {
    ok: resp.status >= 200 && resp.status < 300,
    status: resp.status,
    statusText: resp.statusText,
    text: () => Promise.resolve(resp.body),
    json: () => Promise.resolve(JSON.parse(resp.body)),
  }
}

async function fetchDirect(url: string, apiKey: string, body: string): Promise<Response> {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  }).catch((error) => {
    throw new Error(`Network error during DeepL translation: ${error.message}`)
  })

  return resp
}

async function parseDeepLResponse(resp: DeepLFetchResponse, expectedCount: number): Promise<string[]> {
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
      throw new RangeError(`DeepL translation response count mismatch: expected ${expectedCount}, got ${translations.length}`)
    }

    return translations.map((translation, index) => {
      if (typeof translation?.text !== "string") {
        throw new TypeError(`Unexpected translation format at index ${index}`)
      }
      return translation.text
    })
  }
  catch (error) {
    throw new Error(
      `Failed to parse DeepL translation response: ${(error as Error).message}`,
    )
  }
}

export function getDeepLBaseURL(apiKey: string, configBaseURL?: string): string {
  const trimmedBaseURL = configBaseURL?.trim()
  if (trimmedBaseURL) {
    return trimmedBaseURL.replace(/\/+$/, "")
  }

  return apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com"
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

function formatDeepLLanguageCode(
  lang: LangCodeISO6391,
  direction: "source" | "target",
): string {
  const formattedLang = lang.toUpperCase()

  if (formattedLang === "ZH") {
    return direction === "target" ? "ZH-HANS" : "ZH"
  }

  if (formattedLang === "ZH-TW") {
    return direction === "target" ? "ZH-HANT" : "ZH"
  }

  return formattedLang
}
