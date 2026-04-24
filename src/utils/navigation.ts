import { browser } from "#imports"

export async function openOptionsPage() {
  await browser.tabs.create({
    active: true,
    url: browser.runtime.getURL("/options.html"),
  })
}
