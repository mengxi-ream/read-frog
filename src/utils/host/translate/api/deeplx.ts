import type { LanguageTag } from "@read-frog/definitions"
import type { ProviderConfig } from "@/types/config/provider"
import type { TranslationTextFormat } from "@/types/config/translate"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { toDeepLLanguageCode } from "./language-codes"

type DeepLXProviderConfig = Extract<ProviderConfig, { provider: "deeplx" }>
const API_KEY_PLACEHOLDER_RE = /\{\{apiKey\}\}/g

export async function deeplxTranslate(
  sourceText: string,
  fromLang: LanguageTag | "auto",
  toLang: LanguageTag,
  providerConfig: DeepLXProviderConfig,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string> {
  const baseURL = providerConfig.baseURL || DEFAULT_PROVIDER_CONFIG.deeplx.baseURL
  const apiKey = providerConfig.apiKey

  if (!baseURL) {
    throw new Error("DeepLX baseURL is not configured")
  }

  const url = buildDeepLXUrl(baseURL, apiKey)

  const requestBody = JSON.stringify({
    text: sourceText,
    source_lang: fromLang === "auto" ? "auto" : toDeepLLanguageCode(fromLang, "source"),
    // DeepLX servers have always been sent a bare `ZH` for Simplified Chinese.
    target_lang: toLang === "zh-Hans" ? "ZH" : toDeepLLanguageCode(toLang, "target"),
    ...(options?.textFormat === "html" ? { tag_handling: "html" } : {}),
  })

  const fetchResponse = await fetchDirect(url, requestBody, options?.signal)

  return parseDeepLXResponse(fetchResponse)
}

async function fetchDirect(url: string, body: string, signal?: AbortSignal) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
  }).catch((error) => {
    throw new Error(`Network error during DeepLX translation: ${error.message}`)
  })

  return resp
}

async function parseDeepLXResponse(resp: {
  ok: boolean
  status: number
  statusText: string
  text: () => Promise<string>
  json: () => Promise<any>
}) {
  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "Unable to read error response")
    throw new Error(
      `DeepLX translation request failed: ${resp.status} ${resp.statusText}${
        errorText ? ` - ${errorText}` : ""
      }`,
    )
  }

  try {
    const result = await resp.json()
    if (typeof result?.data !== "string") {
      throw new TypeError("Unexpected response format from DeepLX translation API")
    }
    return result.data
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse DeepLX translation response: ${message}`, { cause: error })
  }
}

export function buildDeepLXUrl(baseURL: string, apiKey?: string): string {
  if (baseURL.includes("{{apiKey}}")) {
    const normalizedApiKey = apiKey?.trim()
    if (!normalizedApiKey) {
      throw new Error("API key is required when using {{apiKey}} placeholder in DeepLX baseURL")
    }
    return baseURL.replace(API_KEY_PLACEHOLDER_RE, normalizedApiKey)
  }

  return baseURL
}
