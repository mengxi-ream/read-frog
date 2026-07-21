// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getEffectiveSiteRule } from "../effective"

function configWithUserRules(userRules: Config["siteRules"]["userRules"]): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.siteRules = { userRules, disabledBuiltInRules: [] }
  return config
}

describe("getEffectiveSiteRule", () => {
  it("memoizes on config identity and url", () => {
    const config = configWithUserRules([])
    const first = getEffectiveSiteRule(config, "https://example.com/")
    const second = getEffectiveSiteRule(config, "https://example.com/")
    expect(second).toBe(first)
  })

  it("recomputes when the url changes", () => {
    const config = configWithUserRules([
      { id: "user", matches: "example.com", excludeSelectors: ["nav"] },
    ])
    const onSite = getEffectiveSiteRule(config, "https://example.com/")
    expect(onSite.excludeSelector).toBe("nav")

    const offSite = getEffectiveSiteRule(config, "https://other.com/")
    expect(offSite.excludeSelector).toBeNull()
  })

  it("recomputes for a fresh config object", () => {
    const before = getEffectiveSiteRule(configWithUserRules([]), "https://example.com/")
    expect(before.excludeSelector).toBeNull()

    const after = getEffectiveSiteRule(
      configWithUserRules([{ id: "user", matches: "example.com", excludeSelectors: ["nav"] }]),
      "https://example.com/",
    )
    expect(after.excludeSelector).toBe("nav")
  })

  it("resolves built-in rules and honors disabledBuiltInRules", () => {
    const enabled = getEffectiveSiteRule(configWithUserRules([]), "https://github.com/foo")
    expect(enabled.matchedRuleIds).toContain("readfrog-github")
    expect(enabled.excludeSelector).toContain("table.diff-table")
    expect(enabled.forceBlockNodeSelector).toContain("task-lists")
    expect(enabled.forceBlockStyleSelector).toContain("task-lists")
    expect(enabled.forceBlockNodeSelector).toBe(enabled.forceBlockStyleSelector)
    expect(enabled.forceInlineNodeSelector).toBeNull()
    expect(enabled.forceInlineStyleSelector).toContain("g-emoji")

    const config = configWithUserRules([])
    config.siteRules.disabledBuiltInRules = ["readfrog-github"]
    const disabled = getEffectiveSiteRule(config, "https://github.com/foo")
    expect(disabled.matchedRuleIds).not.toContain("readfrog-github")
  })

  it("resolves the migrated Steam inline selector as style-only", () => {
    const resolved = getEffectiveSiteRule(
      configWithUserRules([]),
      "https://store.steampowered.com/app/2453660/Hoop_Land/",
    )

    expect(resolved.matchedRuleIds).toContain("steampoweredApp")
    expect(resolved.includeSelector).toBeNull()
    expect(resolved.forceInlineStyleSelector).toBe(".pulldown")
    expect(resolved.forceInlineNodeSelector).toBeNull()
  })
})
