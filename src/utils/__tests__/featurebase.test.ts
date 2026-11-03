import { describe, expect, it } from "vitest"
import { buildFeaturebasePortalUrl } from "@/utils/featurebase"

const SUPPORTED_UI_LOCALES = ["en", "es", "ja", "ko", "ru", "tr", "vi", "zh-CN", "zh-TW"] as const

describe("buildFeaturebasePortalUrl", () => {
  it.each(SUPPORTED_UI_LOCALES)("builds locale-prefixed portal URLs for %s", (locale) => {
    expect(buildFeaturebasePortalUrl({ destination: "feedback", locale })).toBe(
      `https://feedback.readfrog.app/${locale}`,
    )
    expect(buildFeaturebasePortalUrl({ destination: "roadmap", locale })).toBe(
      `https://feedback.readfrog.app/${locale}/roadmap`,
    )
  })

  it("serializes metadata with Featurebase's metaData query parameter", () => {
    const result = buildFeaturebasePortalUrl({
      destination: "feedback",
      locale: "zh-CN",
      metadata: {
        browser: "edge",
        extension_version: "1.43.3",
        page_url: "https://example.com/private/path",
      },
    })
    const url = new URL(result)

    expect(url.pathname).toBe("/zh-CN")
    expect(JSON.parse(url.searchParams.get("metaData")!)).toEqual({
      browser: "edge",
      extension_version: "1.43.3",
      page_url: "https://example.com/private/path",
    })
  })
})
