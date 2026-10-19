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

const CHROME_WEB_STORE_EXTENSION_ID = "modkelfkcfjpgbfmnbnllalkiogfofhb"
const EDGE_ADD_ONS_EXTENSION_ID = "cbcbomlgikfbdnoaohcjfledcoklcjbo"

/**
 * The store this copy was installed from, read off the extension id each store assigns.
 *
 * The build target cannot say: Chrome and Edge run the same build, Edge users can install
 * from the Chrome Web Store, and nothing stops the Chrome zip from being uploaded to Edge.
 * Any other id — an unpacked dev build, or Firefox's gecko id — falls back to the target.
 */
function getInstalledStore(): "chrome" | "edge" | "firefox" {
  if (browser.runtime.id === EDGE_ADD_ONS_EXTENSION_ID) return "edge"
  if (browser.runtime.id === CHROME_WEB_STORE_EXTENSION_ID) return "chrome"
  if (import.meta.env.BROWSER === "edge" || import.meta.env.BROWSER === "firefox") {
    return import.meta.env.BROWSER
  }
  return "chrome"
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
  const store = getInstalledStore()
  if (store === "edge") {
    return `https://microsoftedge.microsoft.com/addons/detail/read-frog-translate-l/${EDGE_ADD_ONS_EXTENSION_ID}?form=MA13IW&utm_source=${utmSource}`
  }
  if (store === "firefox") {
    return `https://addons.mozilla.org/firefox/addon/read-frog-open-ai-translator/reviews/?utm_source=${utmSource}`
  }
  return `https://chromewebstore.google.com/detail/read-frog-translate-learn/${CHROME_WEB_STORE_EXTENSION_ID}/reviews?utm_source=${utmSource}`
}
