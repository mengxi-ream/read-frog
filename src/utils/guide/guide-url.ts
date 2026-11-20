import { env } from "@/env"

// Any guide step rather than one step number: the website decides which step hosts
// what (the dictionary save task moved from step 3 to step 4 once, and tracking it
// silently stopped starting).
const GUIDE_STEP_PATH_PATTERN = /\/guide\/step-\d+$/

/** Whether a URL is one of the website guide's steps, on an official origin. */
export function isGuideStepUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    const isOfficialOrigin = env.WXT_OFFICIAL_SITE_ORIGINS.includes(url.origin)
    const normalizedPathname = url.pathname.replace(/\/$/, "")

    return isOfficialOrigin && GUIDE_STEP_PATH_PATTERN.test(normalizedPathname)
  } catch {
    return false
  }
}
