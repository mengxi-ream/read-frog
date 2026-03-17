export const ANALYTICS_ENABLED_STORAGE_KEY = "analyticsEnabled"
export const ANALYTICS_INSTALL_ID_STORAGE_KEY = "analyticsInstallId"
export const ANALYTICS_FEATURE_USED_EVENT = "feature_used"

export function getDefaultAnalyticsEnabled(browser = import.meta.env.BROWSER): boolean {
  return browser !== "firefox"
}

export const DEFAULT_ANALYTICS_ENABLED = getDefaultAnalyticsEnabled()
