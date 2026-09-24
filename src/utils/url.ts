export function getPageTranslationOriginScope(url: string): string | null {
  try {
    const urlObj = new URL(url)

    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") return null

    return urlObj.origin
  } catch {
    return null
  }
}

export function areSamePageTranslationOrigin(from: string, to: string): boolean {
  const fromScope = getPageTranslationOriginScope(from)
  const toScope = getPageTranslationOriginScope(to)

  return fromScope !== null && fromScope === toScope
}

/**
 * Hostname of an http(s) URL for analytics — no path, query, or fragment, so the
 * event says which site was used without revealing which page.
 */
export function getAnalyticsSiteDomain(url: string | undefined): string | undefined {
  if (!url) return undefined

  try {
    const urlObj = new URL(url)
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") return undefined
    return urlObj.hostname || undefined
  } catch {
    return undefined
  }
}
