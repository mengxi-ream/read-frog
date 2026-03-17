export async function microsoftTranslate(
  sourceText: string,
  fromLang: string,
  toLang: string,
): Promise<string> {
  const results = await microsoftTranslateBatch([sourceText], fromLang, toLang)
  return results[0] ?? ""
}

const MICROSOFT_TOKEN_TTL_MS = 9 * 60 * 1000

let cachedMicrosoftToken: { token: string, expiresAt: number } | null = null
let inflightMicrosoftToken: Promise<string> | null = null

function resetMicrosoftTokenCache() {
  cachedMicrosoftToken = null
  inflightMicrosoftToken = null
}

async function getMicrosoftToken(): Promise<string> {
  const now = Date.now()
  if (cachedMicrosoftToken && cachedMicrosoftToken.expiresAt > now) {
    return cachedMicrosoftToken.token
  }

  if (inflightMicrosoftToken) {
    return inflightMicrosoftToken
  }

  inflightMicrosoftToken = refreshMicrosoftToken()
    .then((token) => {
      cachedMicrosoftToken = {
        token,
        expiresAt: Date.now() + MICROSOFT_TOKEN_TTL_MS,
      }
      return token
    })
    .finally(() => {
      inflightMicrosoftToken = null
    })

  return inflightMicrosoftToken
}

interface MicrosoftTranslationError extends Error {
  status?: number
}

async function translateWithMicrosoftToken(
  sourceTexts: string[],
  fromLang: string,
  toLang: string,
  token: string,
): Promise<string[]> {
  const effectiveFromLang = fromLang === "auto" ? "" : fromLang

  const resp = await fetch(
    `https://api-edge.cognitive.microsofttranslator.com/translate?from=${effectiveFromLang}&to=${toLang}&api-version=3.0&includeSentenceLength=true&textType=html`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": token,
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(sourceTexts.map(text => ({ Text: text }))),
    },
  ).catch((error) => {
    throw new Error(
      `Network error during Microsoft translation: ${error.message}`,
    )
  })

  if (!resp.ok) {
    const errorText = await resp
      .text()
      .catch(() => "Unable to read error response")

    const error = new Error(
      `Microsoft translation request failed: ${resp.status} ${resp.statusText}${
        errorText ? ` - ${errorText}` : ""
      }`,
    ) as MicrosoftTranslationError

    error.status = resp.status
    throw error
  }

  try {
    const result = await resp.json()

    if (!Array.isArray(result)) {
      throw new TypeError("Unexpected response format from Microsoft translation API")
    }

    const translations = result.map((item, index) => {
      const text = item?.translations?.[0]?.text
      if (typeof text !== "string") {
        throw new TypeError(
          `Unexpected response format from Microsoft translation API (index ${index})`,
        )
      }
      return text
    })

    return translations
  }
  catch (error) {
    throw new Error(
      `Failed to parse Microsoft translation response: ${(error as Error).message}`,
    )
  }
}

export async function microsoftTranslateBatch(
  sourceTexts: string[],
  fromLang: string,
  toLang: string,
): Promise<string[]> {
  if (sourceTexts.length === 0) {
    return []
  }

  const token = await getMicrosoftToken()

  try {
    return await translateWithMicrosoftToken(sourceTexts, fromLang, toLang, token)
  }
  catch (error) {
    const err = error as MicrosoftTranslationError
    // The free token occasionally expires; refresh and retry once for auth failures.
    if (err.status === 401 || err.status === 403) {
      resetMicrosoftTokenCache()
      const refreshedToken = await getMicrosoftToken()
      return await translateWithMicrosoftToken(sourceTexts, fromLang, toLang, refreshedToken)
    }
    throw error
  }
}

async function refreshMicrosoftToken(): Promise<string> {
  try {
    const resp = await fetch("https://edge.microsoft.com/translate/auth")

    if (!resp.ok) {
      throw new Error(
        `Failed to refresh Microsoft token: ${resp.status} ${resp.statusText}`,
      )
    }

    return await resp.text()
  }
  catch (error) {
    throw new Error(
      `Error refreshing Microsoft token: ${(error as Error).message}`,
    )
  }
}
