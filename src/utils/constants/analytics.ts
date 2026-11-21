export const ANALYTICS_ENABLED_STORAGE_KEY = "analyticsEnabled"
export const ANALYTICS_INSTALL_ID_STORAGE_KEY = "analyticsInstallId"
export const ANALYTICS_FEATURE_USED_EVENT = "feature_used"
/** Built-in AI refused a feature and someone was asked to log in or upgrade. */
export const ANALYTICS_BUILT_IN_AI_PROMPT_SHOWN_EVENT = "built_in_ai_prompt_shown"
/** What they did about it. */
export const ANALYTICS_BUILT_IN_AI_PROMPT_ACTION_EVENT = "built_in_ai_prompt_action"

export function getDefaultAnalyticsEnabled(browser = import.meta.env.BROWSER): boolean {
  return browser !== "firefox"
}

export const DEFAULT_ANALYTICS_ENABLED = getDefaultAnalyticsEnabled()
