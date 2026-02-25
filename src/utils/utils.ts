import { browser } from "#imports"

export function getActiveTabUrl() {
  return browser.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0].url)
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
  return num.toString().replace(/\B(?=(?:\d{3})+(?!\d))/g, ",")
}

export function numberToPercentage(num: number) {
  return `${(num * 100).toFixed(2)}%`
}

export function getDateFromDaysBack(daysBack: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysBack)
  return date
}

export function getReviewUrl(utmSource: string = "extension"): string {
  if (import.meta.env.BROWSER === "edge") {
    return "https://microsoftedge.microsoft.com/addons/detail/read-frog-open-source-i/cbcbomlgikfbdnoaohcjfledcoklcjbo?form=MA13IW"
  }
  return `https://chromewebstore.google.com/detail/read-frog-open-source-imm/modkelfkcfjpgbfmnbnllalkiogfofhb/reviews?utm_source=${utmSource}`
}
