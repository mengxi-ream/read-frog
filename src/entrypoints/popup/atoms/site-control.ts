import type { Getter, Setter } from "jotai"
import { browser } from "#imports"
import { atom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { matchDomainPattern } from "@/utils/url"
import { getActiveTabUrl } from "@/utils/utils"

export function isInSiteControlList(patterns: string[], url: string): boolean {
  return patterns.some(p => matchDomainPattern(url, p))
}

// Atom to track if current site is in patterns
export const isCurrentSiteInWhitelistAtom = atom<boolean>(false)
export const isCurrentSiteInBlacklistAtom = atom<boolean>(false)

async function toggleSiteInPatterns(
  get: Getter,
  set: Setter,
  checked: boolean,
  patternsKey: "blacklistPatterns" | "whitelistPatterns",
) {
  const siteControlConfig = get(configFieldsAtomMap.siteControl)
  const activeTabUrl = await getActiveTabUrl()

  if (!activeTabUrl)
    return

  const currentPatterns = siteControlConfig[patternsKey]
  const hostname = new URL(activeTabUrl).hostname

  if (checked) {
    if (currentPatterns.some(pattern => matchDomainPattern(activeTabUrl, pattern)))
      return
    await set(configFieldsAtomMap.siteControl, {
      ...siteControlConfig,
      [patternsKey]: [...currentPatterns, hostname],
    })
  }
  else {
    const filteredPatterns = currentPatterns.filter(pattern =>
      !matchDomainPattern(activeTabUrl, pattern),
    )
    await set(configFieldsAtomMap.siteControl, {
      ...siteControlConfig,
      [patternsKey]: filteredPatterns,
    })
  }

  const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (currentTab.id) {
    void browser.tabs.reload(currentTab.id)
  }
}

// Atom to toggle current site in whitelist patterns
export const toggleCurrentSiteInWhitelistAtom = atom(
  null,
  async (get, set, checked: boolean) => {
    await toggleSiteInPatterns(get, set, checked, "whitelistPatterns")
    set(isCurrentSiteInWhitelistAtom, checked)
  },
)

// Atom to toggle current site in blacklist patterns
export const toggleCurrentSiteInBlacklistAtom = atom(
  null,
  async (get, set, checked: boolean) => {
    await toggleSiteInPatterns(get, set, checked, "blacklistPatterns")
    set(isCurrentSiteInBlacklistAtom, checked)
  },
)
