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
