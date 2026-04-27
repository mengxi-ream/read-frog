import { browser } from "#imports"

export function getExtensionShortcutSettingsUrl(userAgent = navigator.userAgent) {
  const normalizedUserAgent = userAgent.toLowerCase()

  if (normalizedUserAgent.includes("edg/")) {
    return "edge://extensions/shortcuts"
  }

  if (normalizedUserAgent.includes("firefox/")) {
    return "about:addons"
  }

  return "chrome://extensions/shortcuts"
}

export async function openExtensionShortcutSettings(userAgent = navigator.userAgent) {
  await browser.tabs.create({
    active: true,
    url: getExtensionShortcutSettingsUrl(userAgent),
  })
}

export async function openOptionsPage() {
  await browser.tabs.create({
    active: true,
    url: browser.runtime.getURL("/options.html"),
  })
}
