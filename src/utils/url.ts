import { z } from "zod"

export function getPageTranslationOriginScope(url: string): string | null {
  try {
    const urlObj = new URL(url)

    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:")
      return null

    return urlObj.origin
  }
  catch {
    return null
  }
}

export function areSamePageTranslationOrigin(from: string, to: string): boolean {
  const fromScope = getPageTranslationOriginScope(from)
  const toScope = getPageTranslationOriginScope(to)

  return fromScope !== null && fromScope === toScope
}

export function matchDomainPattern(url: string, pattern: string): boolean {
  if (!z.url().safeParse(url).success) {
    return false
  }

  const urlObj = new URL(url)
  const hostname = urlObj.hostname.toLowerCase()
  const patternLower = pattern.toLowerCase().trim()

  if (hostname === patternLower) {
    return true
  }

  if (hostname.endsWith(`.${patternLower}`)) {
    return true
  }

  return false
}
