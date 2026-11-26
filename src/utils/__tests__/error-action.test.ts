import { describe, expect, it } from "vitest"
import { ANALYTICS_FEATURE } from "@/types/analytics"
import { pricingUrl, upgradeAction } from "@/utils/error-action"

/** The website reads both: `entry` says which wall, `feature` which feature hit it. */
const ATTRIBUTION_FEATURE = /^[a-z][a-z0-9_]{0,47}$/

describe("pricing links", () => {
  it("names the feature that hit the wall", () => {
    const url = new URL(pricingUrl("extension_quota_exhausted", ANALYTICS_FEATURE.WORD_ANNOTATION))

    expect(url.pathname).toBe("/pricing")
    expect(url.searchParams.get("entry")).toBe("extension_quota_exhausted")
    expect(url.searchParams.get("feature")).toBe("word_annotation")
  })

  it("leaves the feature off a wall no single feature raised", () => {
    const url = new URL(pricingUrl("extension_plan_badge"))

    expect(url.searchParams.get("entry")).toBe("extension_plan_badge")
    expect(url.searchParams.has("feature")).toBe(false)
  })

  it("carries the feature through the upgrade button", () => {
    const action = upgradeAction("extension_video_quota", ANALYTICS_FEATURE.VIDEO_SUBTITLES)

    expect(action.label).toBe("action.upgrade")
    expect(new URL(action.url).searchParams.get("feature")).toBe("video_subtitles")
  })

  it("only ever sends a feature name the website accepts", () => {
    for (const feature of Object.values(ANALYTICS_FEATURE)) {
      expect(feature).toMatch(ATTRIBUTION_FEATURE)
    }
  })
})
