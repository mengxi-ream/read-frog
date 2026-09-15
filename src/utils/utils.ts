import { browser } from "#imports"

const THOUSANDS_SEPARATOR_PATTERN = /\B(?=(?:\d{3})+(?!\d))/g

export function isNonNullish<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}

export function getActiveTabUrl() {
  return browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0]!.url)
}

/**
 * Get value from map; if not exists, create it with factory and return it.
 */
export function ensureKeyInMap<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  let val = map.get(key)
  if (val === undefined) {
    val = factory()
    map.set(key, val)
  }
  return val
}

export function addThousandsSeparator(num: number) {
  return num.toString().replace(THOUSANDS_SEPARATOR_PATTERN, ",")
}

export function numberToPercentage(num: number) {
  return `${(num * 100).toFixed(2)}%`
}

export function getDateFromDaysBack(daysBack: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysBack)
  return date
}

/**
 * Deep links into each store's reviews UI rather than its landing page, so the user does
 * not have to go hunting for where to leave one.
 *
 * Chrome and AMO both have a real `/reviews` route that renders the reviews view on a
 * cold load. Edge has neither: `/reviews` silently redirects back to the product page,
 * and while the reviews block does carry a `#review-section` anchor, the listing is a
 * SPA that renders it only after the browser has already resolved the fragment — the
 * anchor was measured landing at scrollY 0 on every cold load, in headless and real
 * Chrome alike, and only ever "works" as a same-document hash change. So Edge gets the
 * plain listing until Microsoft ships a reviews route.
 *
 * Slugs are cosmetic — the extension id resolves the listing — but they are kept current
 * so the click does not eat a redirect hop.
 */
export function getReviewUrl(utmSource: string = "extension"): string {
  if (import.meta.env.BROWSER === "edge") {
    return `https://microsoftedge.microsoft.com/addons/detail/read-frog-translate-l/cbcbomlgikfbdnoaohcjfledcoklcjbo?form=MA13IW&utm_source=${utmSource}`
  }
  if (import.meta.env.BROWSER === "firefox") {
    return `https://addons.mozilla.org/firefox/addon/read-frog-open-ai-translator/reviews/?utm_source=${utmSource}`
  }
  return `https://chromewebstore.google.com/detail/read-frog-translate-learn/modkelfkcfjpgbfmnbnllalkiogfofhb/reviews?utm_source=${utmSource}`
}
