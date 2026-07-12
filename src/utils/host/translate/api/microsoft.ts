import type { TranslationTextFormat } from "@/types/config/translate"

export async function microsoftTranslate(
  source: string,
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat },
): Promise<string>
export async function microsoftTranslate(
  source: string[],
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat },
): Promise<string[]>
export async function microsoftTranslate(
  source: string | string[],
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat },
): Promise<string | string[]> {
  const isSingle = typeof source === "string"
  const texts = isSingle ? [source] : source

  if (texts.length === 0) {
    return []
  }

  const effectiveFromLang = fromLang === "auto" ? "" : fromLang
  const token = await refreshMicrosoftToken()

  // plain translates the source as literal text (tag-like text such as "<b then"
  // is otherwise left untranslated); html preserves the markup structure of
  // translationOnly page-mode fragments.
  const textType = options?.textFormat === "html" ? "html" : "plain"

  const resp = await fetch(
    `https://api-edge.cognitive.microsofttranslator.com/translate?from=${effectiveFromLang}&to=${toLang}&api-version=3.0&includeSentenceLength=true&textType=${textType}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": token,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(texts.map((text) => ({ Text: text }))),
    },
  ).catch((error) => {
    throw new Error(`Network error during Microsoft translation: ${error.message}`)
  })

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "Unable to read error response")
    throw new Error(
      `Microsoft translation request failed: ${resp.status} ${resp.statusText}${
        errorText ? ` - ${errorText}` : ""
      }`,
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

    return isSingle ? translations[0] : translations
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse Microsoft translation response: ${message}`, { cause: error })
  }
}

export async function refreshMicrosoftToken(): Promise<string> {
  try {
    const resp = await fetch("https://edge.microsoft.com/translate/auth")

    if (!resp.ok) {
      throw new Error(`Failed to refresh Microsoft token: ${resp.status} ${resp.statusText}`)
    }

    return await resp.text()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Error refreshing Microsoft token: ${message}`, { cause: error })
  }
}
