import type { Config } from "@/types/config/config"
import { matchDomainPattern } from "./url"

// Programmatic iframe injection writes the resolved owner-page URL here so
// about:blank/about:srcdoc frames can inherit the site-control decision of
// the real page context they belong to.
export const SITE_CONTROL_URL_WINDOW_KEY = "__READ_FROG_SITE_CONTROL_URL__" as const

declare global {
  interface Window {
    __READ_FROG_SITE_CONTROL_URL__?: string
  }
}

export function isSiteEnabled(url: string, config: Config | null): boolean {
  if (!config)
    return true

  const { mode, blacklistPatterns, whitelistPatterns } = config.siteControl

  if (mode === "blacklist")
    return !blacklistPatterns.some(pattern => matchDomainPattern(url, pattern))

  return whitelistPatterns.some(pattern => matchDomainPattern(url, pattern))
}

// "Effective site-control URL" means the URL we ultimately use to decide
// whether this frame should enable the extension. For normal pages that is
// window.location.href. For blank/srcdoc iframes it is the resolved ancestor
// page URL injected by the background script.
export function resolveEffectiveSiteControlUrl(url: string, injectedSiteControlUrl?: string): string {
  return injectedSiteControlUrl ?? url
}

export function getEffectiveSiteControlUrl(url: string): string {
  if (typeof window === "undefined") {
    return url
  }

  return resolveEffectiveSiteControlUrl(url, window.__READ_FROG_SITE_CONTROL_URL__)
}

export function clearEffectiveSiteControlUrl(): void {
  if (typeof window === "undefined") {
    return
  }

  delete window.__READ_FROG_SITE_CONTROL_URL__
}
