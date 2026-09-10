import type { Config } from "@/types/config/config"
import { atom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { sitePatternForHost, urlMatchesPattern } from "@/utils/url-pattern"
import { getActiveTabUrl } from "@/utils/utils"

type TranslateConfig = Config["pageTranslation"]

// Sync atom to store the checked state
export const isCurrentSiteInPatternsAtom = atom<boolean>(false)

export async function getIsInPatterns(translateConfig: TranslateConfig) {
  const activeTabUrl = await getActiveTabUrl()
  if (!activeTabUrl) return false
  return translateConfig.page.autoTranslatePatterns.some((pattern) =>
    urlMatchesPattern(activeTabUrl, pattern),
  )
}

// Async atom to initialize the checked state
export const initIsCurrentSiteInPatternsAtom = atom(null, async (get, set) => {
  const translateConfig = get(configFieldsAtomMap.pageTranslation)
  set(isCurrentSiteInPatternsAtom, await getIsInPatterns(translateConfig))
})

// Atom to toggle current site in auto-translate patterns
export const toggleCurrentSiteAtom = atom(null, async (get, set, checked: boolean) => {
  const translateConfig = get(configFieldsAtomMap.pageTranslation)
  const activeTabUrl = await getActiveTabUrl()

  if (!activeTabUrl) return

  const currentPatterns = translateConfig.page.autoTranslatePatterns
  // The user pointed at a page, not at a pattern: "this site" means this host
  // and anything under it, which is what it has always meant here.
  const hostPattern = sitePatternForHost(new URL(activeTabUrl).hostname)

  if (checked) {
    // Add hostname to patterns if not already present
    if (!currentPatterns.some((pattern) => urlMatchesPattern(activeTabUrl, pattern))) {
      void set(configFieldsAtomMap.pageTranslation, {
        page: {
          ...translateConfig.page,
          autoTranslatePatterns: [...currentPatterns, hostPattern],
        },
      })
    }
  } else {
    // Remove patterns that match the current hostname
    const filteredPatterns = currentPatterns.filter(
      (pattern) => !urlMatchesPattern(activeTabUrl, pattern),
    )
    void set(configFieldsAtomMap.pageTranslation, {
      page: {
        ...translateConfig.page,
        autoTranslatePatterns: filteredPatterns,
      },
    })
  }

  // Update the local state
  set(isCurrentSiteInPatternsAtom, checked)
})

export const isPageTranslatedAtom = atom<boolean>(false)
