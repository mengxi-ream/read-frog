import { browser } from "#imports"

export interface OpenOptionsPageOptions {
  route?: `/${string}`
}

export async function openOptionsPage(options?: OpenOptionsPageOptions) {
  const route = options?.route ?? ""

  if (!route && browser.runtime.openOptionsPage) {
    try {
      await browser.runtime.openOptionsPage()
      return
    } catch {
      // Some extension hosts expose the API but still fail to open the page.
    }
  }

  await browser.tabs.create({
    active: true,
    url: browser.runtime.getURL(`/options.html${route ? `#${route}` : ""}`),
  })
}
