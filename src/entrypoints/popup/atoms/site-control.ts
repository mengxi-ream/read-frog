import type { Config } from '@/types/config/config'
import { browser } from '#imports'
import { atom } from 'jotai'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { matchDomainPattern } from '@/utils/url'
import { getActiveTabUrl } from '@/utils/utils'

type SiteControlConfig = Config['siteControl']

// Atom to track if whitelist mode is enabled
export const isWhitelistModeAtom = atom<boolean>(false)

// Atom to track if current site is in whitelist patterns
export const isCurrentSiteInWhitelistAtom = atom<boolean>(false)

export async function getIsInWhitelist(siteControlConfig: SiteControlConfig) {
  const activeTabUrl = await getActiveTabUrl()
  if (!activeTabUrl)
    return false
  return siteControlConfig.patterns.some(pattern =>
    matchDomainPattern(activeTabUrl, pattern),
  )
}

// Async atom to initialize the whitelist state
export const initSiteControlAtomsAtom = atom(
  null,
  async (get, set) => {
    const siteControlConfig = get(configFieldsAtomMap.siteControl)
    set(isWhitelistModeAtom, siteControlConfig.mode === 'whitelist')
    set(isCurrentSiteInWhitelistAtom, await getIsInWhitelist(siteControlConfig))
  },
)

// Atom to toggle current site in whitelist patterns
export const toggleCurrentSiteInWhitelistAtom = atom(
  null,
  async (get, set, checked: boolean) => {
    const siteControlConfig = get(configFieldsAtomMap.siteControl)
    const activeTabUrl = await getActiveTabUrl()

    if (!activeTabUrl)
      return

    const currentPatterns = siteControlConfig.patterns
    const hostname = new URL(activeTabUrl).hostname

    if (checked) {
      // Add hostname to patterns if not already present
      if (!currentPatterns.some(pattern => matchDomainPattern(activeTabUrl, pattern))) {
        void set(configFieldsAtomMap.siteControl, {
          ...siteControlConfig,
          patterns: [...currentPatterns, hostname],
        })
      }
    }
    else {
      // Remove patterns that match the current hostname
      const filteredPatterns = currentPatterns.filter(pattern =>
        !matchDomainPattern(activeTabUrl, pattern),
      )
      void set(configFieldsAtomMap.siteControl, {
        ...siteControlConfig,
        patterns: filteredPatterns,
      })
    }

    // Update the local state
    set(isCurrentSiteInWhitelistAtom, checked)

    // Reload tab so content scripts re-initialize with new whitelist status
    const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (currentTab.id) {
      void browser.tabs.reload(currentTab.id)
    }
  },
)
