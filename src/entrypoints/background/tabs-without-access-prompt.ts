import type { Browser } from "#imports"
import { browser } from "#imports"

// Safari asks the user for access to a website whenever the extension looks up
// a tab on a site it hasn't been allowed on: `tabs.query` asks about every tab
// it matches, `tabs.get` about the tab it gets. A `url` filter is the
// exception, since a tab on such a site never matches one. So lookups the user
// didn't start (at startup, on tab and storage events, for messages from
// content scripts) go through a filter to web pages in Safari, which leaves
// those tabs out. Other browsers don't ask, and get the plain call.

/** `browser.tabs.query`, but in Safari without the tabs it would have to ask about. */
export function queryTabsWithoutAccessPrompt(queryInfo: Omit<Browser.tabs.QueryInfo, "url">) {
  return browser.tabs.query(
    import.meta.env.BROWSER === "safari" ? { ...queryInfo, url: "*://*/*" } : queryInfo,
  )
}

/** `browser.tabs.get`, but in Safari `undefined` for a tab it would have to ask about. */
export async function getTabWithoutAccessPrompt(
  tabId: number,
): Promise<Browser.tabs.Tab | undefined> {
  if (import.meta.env.BROWSER !== "safari") {
    return browser.tabs.get(tabId)
  }

  const tabs = await queryTabsWithoutAccessPrompt({})
  return tabs.find((tab) => tab.id === tabId)
}
