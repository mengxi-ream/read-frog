import { atom } from 'jotai'

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
