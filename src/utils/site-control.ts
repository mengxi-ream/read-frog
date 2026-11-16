import type { Config } from "@/types/config/config"
import { urlMatchesPattern } from "./url-pattern"

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
  if (!config) return true

  const { mode, blacklistPatterns, whitelistPatterns } = config.siteControl

  if (mode === "blacklist")
    return !blacklistPatterns.some((pattern) => urlMatchesPattern(url, pattern))

  return whitelistPatterns.some((pattern) => urlMatchesPattern(url, pattern))
}

/**
 * Whether the extension runs in a frame whose own url is `frameUrl`, in a tab
 * showing `pageUrl`. The page decides. In blacklist mode a frame from a listed
 * site stays off on any page too, such as a disabled video site's player
 * embedded somewhere else. A whitelist lists the pages people read, not the
 * sites their frames come from: on an edX course page the popup lists
 * learning.edx.org, while the videos play in a frame from courses.edx.org.
 */
export function isFrameSiteEnabled(
  frameUrl: string,
  pageUrl: string,
  config: Config | null,
): boolean {
  if (!isSiteEnabled(pageUrl, config)) return false
  return config?.siteControl.mode === "whitelist" || isSiteEnabled(frameUrl, config)
}

// "Effective site-control URL" means the URL we ultimately use to decide
// whether this frame should enable the extension. For normal pages that is
// window.location.href. For blank/srcdoc iframes it is the resolved ancestor
// page URL injected by the background script.
export function resolveEffectiveSiteControlUrl(
  url: string,
  injectedSiteControlUrl?: string,
): string {
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
