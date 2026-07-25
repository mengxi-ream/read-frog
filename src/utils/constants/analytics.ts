export const ANALYTICS_ENABLED_STORAGE_KEY = "analyticsEnabled"
export const ANALYTICS_INSTALL_ID_STORAGE_KEY = "analyticsInstallId"
export const ANALYTICS_FEATURE_USED_EVENT = "feature_used"
export const ANALYTICS_TRANSLATION_REQUESTED_EVENT = "translation_requested"
export const ANALYTICS_TRANSLATION_PROMPT_USED_EVENT = "translation_prompt_used"
export const PROMPT_EXPERIMENT_COHORT_STORAGE_KEY = "promptExperimentCohortV1"
export const PROMPT_EXPERIMENT_FLAG_KEY = "new-user-default-translate-prompt-v1"
export const PROMPT_EXPERIMENT_FLAG_WAIT_MS = 500

export function getDefaultAnalyticsEnabled(browser = import.meta.env.BROWSER): boolean {
  return browser !== "firefox"
}

export const DEFAULT_ANALYTICS_ENABLED = getDefaultAnalyticsEnabled()
