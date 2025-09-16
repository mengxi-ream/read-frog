import type { LangCodeISO6391 } from '@repo/definitions'
import type { PureAPIProviderConfig } from '@/types/config/provider'
import { DEFAULT_PROVIDER_CONFIG } from '@/utils/constants/providers'
import { sendMessage } from '@/utils/message'

export async function deeplxTranslate(
  sourceText: string,
  fromLang: LangCodeISO6391 | 'auto',
  toLang: LangCodeISO6391,
  providerConfig: PureAPIProviderConfig,
  options?: { forceBackgroundFetch?: boolean },
): Promise<string> {
  const baseURL = providerConfig.baseURL ?? DEFAULT_PROVIDER_CONFIG.deeplx.baseURL
  const apiKey = providerConfig.apiKey

  if (!baseURL) {
    throw new Error('DeepLX baseURL is not configured')
  }

  const formatLang = (lang: LangCodeISO6391 | 'auto') => {
    if (lang === 'auto')
      return 'auto'
    let formattedLang = lang.toUpperCase()
    if (formattedLang === 'ZH-TW')
      formattedLang = 'ZH-HANT'
    return formattedLang
  }

  const url = buildDeepLXUrl(baseURL, apiKey)

  const requestBody = JSON.stringify({
    text: sourceText,
    source_lang: formatLang(fromLang),
    target_lang: formatLang(toLang),
  })

  const fetchResponse = options?.forceBackgroundFetch
    ? await fetchViaBackground(url, requestBody)
    : await fetchDirect(url, requestBody)

  return parseDeepLXResponse(fetchResponse)
}

async function fetchViaBackground(url: string, body: string) {
  const resp = await sendMessage('backgroundFetch', {
    url,
    method: 'POST',
    headers: [['Content-Type', 'application/json']],
    body,
    credentials: 'omit',
  })

  return {
    ok: resp.status >= 200 && resp.status < 300,
    status: resp.status,
    statusText: resp.statusText,
    text: () => Promise.resolve(resp.body),
    json: () => Promise.resolve(JSON.parse(resp.body)),
  }
}

async function fetchDirect(url: string, body: string) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch((error) => {
    throw new Error(`Network error during DeepLX translation: ${error.message}`)
  })

  return resp
}

async function parseDeepLXResponse(resp: { ok: boolean, status: number, statusText: string, text: () => Promise<string>, json: () => Promise<any> }) {
  if (!resp.ok) {
    const errorText = await resp.text().catch(() => 'Unable to read error response')
    throw new Error(
      `DeepLX translation request failed: ${resp.status} ${resp.statusText}${
        errorText ? ` - ${errorText}` : ''
      }`,
    )
  }

  try {
    const result = await resp.json()
    if (typeof result?.data !== 'string') {
      throw new TypeError('Unexpected response format from DeepLX translation API')
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
  // Remove trailing slash from baseURL
  const cleanBaseURL = baseURL.replace(/\/+$/, '')

  // If baseURL contains {{apiKey}} placeholder, replace it with the API key
  if (cleanBaseURL.includes('{{apiKey}}')) {
    if (!apiKey) {
      throw new Error('API key is required when using {{apiKey}} placeholder in DeepLX baseURL')
    }
    return cleanBaseURL.replace(/\{\{apiKey\}\}/g, apiKey)
  }

  // Special logic for api.deeplx.org: insert token between .org and /translate
  if (cleanBaseURL === 'https://api.deeplx.org') {
    if (apiKey) {
      return `https://api.deeplx.org/${apiKey}/translate`
    }
    return `${cleanBaseURL}/translate`
  }

  // For baseURL without /translate, add it at the end
  if (!cleanBaseURL.endsWith('/translate')) {
    if (apiKey) {
      return `${cleanBaseURL}/${apiKey}/translate`
    }
    return `${cleanBaseURL}/translate`
  }

  // If baseURL already ends with /translate, use it as-is
  // This handles cases like "https://api.example.com/v1/translate"
  return cleanBaseURL
}
