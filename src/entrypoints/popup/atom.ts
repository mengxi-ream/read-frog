import { atom } from 'jotai'
import { configFields } from '@/utils/atoms/config'
import { getActiveTabUrl } from '@/utils/utils'

const EMPTY_TAB_URLS = [
  'about:blank',
  'chrome://newtab/',
  'edge://newtab/',
  'about:newtab',
]

const EXTENSION_URLS = [
  'chrome-extension://',
  'edge-extension://',
  'chrome://newtab/',
  'edge://newtab/',
]

async function checkIgnoreTab() {
  if (typeof window !== 'undefined' && browser.tabs) {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    const currentTab = tabs[0]
    const currentUrl = currentTab?.url || ''

    return (
      EMPTY_TAB_URLS.some(url => currentUrl.includes(url))
      || EXTENSION_URLS.some(url => currentUrl.includes(url))
    )
  }
  return false
}

export const isIgnoreTabAtom = atom<boolean>(false)

// Create a derived atom for initialization
export const initIsIgnoreTabAtom = atom(null, async (get, set) => {
  const isIgnore = await checkIgnoreTab()
  set(isIgnoreTabAtom, isIgnore)
})

// Sync atom to store the checked state
export const isCurrentSiteInPatternsAtom = atom<boolean>(false)

// Async atom to initialize the checked state
export const initIsCurrentSiteInPatternsAtom = atom(
  null,
  async (get, set) => {
    const translateConfig = get(configFields.translate)
    const activeTabUrl = await getActiveTabUrl()

    if (!activeTabUrl) {
      set(isCurrentSiteInPatternsAtom, false)
      return
    }

    const isInPatterns = translateConfig.page.autoTranslatePatterns.some(pattern =>
      activeTabUrl.includes(pattern),
    )
    set(isCurrentSiteInPatternsAtom, isInPatterns)
  },
)

// Atom to toggle current site in auto-translate patterns
export const toggleCurrentSiteAtom = atom(
  null,
  async (get, set, checked: boolean) => {
    const translateConfig = get(configFields.translate)
    const activeTabUrl = await getActiveTabUrl()

    if (!activeTabUrl)
      return

    const currentPatterns = translateConfig.page.autoTranslatePatterns
    const hostname = new URL(activeTabUrl).hostname

    if (checked) {
      // Add hostname to patterns if not already present
      if (!currentPatterns.some(pattern => hostname.includes(pattern))) {
        set(configFields.translate, {
          page: {
            ...translateConfig.page,
            autoTranslatePatterns: [...currentPatterns, hostname],
          },
        })
      }
    }
    else {
      // Remove patterns that match the current hostname
      const filteredPatterns = currentPatterns.filter(pattern =>
        !hostname.includes(pattern),
      )
      set(configFields.translate, {
        page: {
          ...translateConfig.page,
          autoTranslatePatterns: filteredPatterns,
        },
      })
    }

    // Update the local state
    set(isCurrentSiteInPatternsAtom, checked)
  },
)
