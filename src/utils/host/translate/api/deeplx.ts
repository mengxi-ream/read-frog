import type { LangCodeISO6391 } from "@read-frog/definitions"
import type { ProviderConfig } from "@/types/config/provider"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"

type DeepLXProviderConfig = Extract<ProviderConfig, { provider: "deeplx" }>
const API_KEY_PLACEHOLDER_RE = /\{\{apiKey\}\}/g

export async function deeplxTranslate(
  sourceText: string,
  fromLang: LangCodeISO6391 | "auto",
  toLang: LangCodeISO6391,
  providerConfig: DeepLXProviderConfig,
): Promise<string> {
  const baseURL = providerConfig.baseURL || DEFAULT_PROVIDER_CONFIG.deeplx.baseURL
  const apiKey = providerConfig.apiKey

  if (!baseURL) {
    throw new Error("DeepLX baseURL is not configured")
  }

  const formatLang = (lang: LangCodeISO6391 | "auto") => {
    if (lang === "auto")
      return "auto"
    let formattedLang = lang.toUpperCase()
    if (formattedLang === "ZH-TW")
      formattedLang = "ZH-HANT"
    return formattedLang
  }

  const url = buildDeepLXUrl(baseURL, apiKey)

  const requestBody = JSON.stringify({
    text: sourceText,
    source_lang: formatLang(fromLang),
    target_lang: formatLang(toLang),
  })

  const fetchResponse = await fetchDirect(url, requestBody)

  return parseDeepLXResponse(fetchResponse)
}

async function fetchDirect(url: string, body: string) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch((error) => {
    throw new Error(`Network error during DeepLX translation: ${error.message}`)
  })

  return resp
}

async function parseDeepLXResponse(resp: { ok: boolean, status: number, statusText: string, text: () => Promise<string>, json: () => Promise<any> }) {
  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "Unable to read error response")
    throw new Error(
      `DeepLX translation request failed: ${resp.status} ${resp.statusText}${errorText ? ` - ${errorText}` : ""
      }`,
    )
  }

  try {
    const result = await resp.json()
    if (typeof result?.data !== "string") {
      throw new TypeError("Unexpected response format from DeepLX translation API")
    }
    return result.data
  }
  catch (error) {
    throw new Error(
      `Failed to parse DeepLX translation response: ${(error as Error).message}`,
    )
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
