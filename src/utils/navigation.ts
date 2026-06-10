import { browser } from "#imports"

export interface OpenOptionsPageOptions {
  route?: `/${string}`
}

export async function openOptionsPage(options?: OpenOptionsPageOptions) {
  const route = options?.route ?? ""

  await browser.tabs.create({
    active: true,
    url: browser.runtime.getURL(`/options.html${route ? `#${route}` : ""}`),
  })
}
