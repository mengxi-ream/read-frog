import type { StoredRemoteSiteRules } from "../remote/storage"
import type { Config } from "@/types/config/config"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  getActiveBuiltInSiteRules,
  loadRemoteSiteRules,
  setRemoteSiteRulesDocument,
  subscribeActiveBuiltInSiteRules,
} from "../active"
import { BUILT_IN_SITE_RULES } from "../built-in"
import { getEffectiveSiteRule } from "../effective"
import { setStoredRemoteSiteRules } from "../remote/storage"

const RULE_URL = "https://remote-rules.test/"

function storedRules(
  excludeSelector: string,
  { revision = 100, extensionVersion = "1.58.1" } = {},
): StoredRemoteSiteRules {
  return {
    format: 1,
    revision,
    extensionVersion,
    rules: [{ id: "remote", matches: "remote-rules.test", excludeSelectors: [excludeSelector] }],
    fetchedAt: 1,
  }
}

function freshConfig(): Config {
  return structuredClone(DEFAULT_CONFIG)
}

beforeEach(() => {
  fakeBrowser.reset()
  vi.spyOn(fakeBrowser.runtime, "getManifest").mockReturnValue({
    manifest_version: 3,
    name: "Read Frog",
    version: "1.58.1",
  })
})

afterEach(() => {
  setRemoteSiteRulesDocument(null)
  vi.restoreAllMocks()
})

describe("active built-in site rules", () => {
  it("are the bundled rules while nothing is stored", async () => {
    expect(getActiveBuiltInSiteRules()).toBe(BUILT_IN_SITE_RULES)
    await loadRemoteSiteRules()
    expect(getActiveBuiltInSiteRules()).toBe(BUILT_IN_SITE_RULES)
  })

  it("follow the stored document and its updates, re-resolving memoized site rules", async () => {
    const config = freshConfig()
    expect(getEffectiveSiteRule(config, RULE_URL).excludeSelector).toBeNull()

    await setStoredRemoteSiteRules(storedRules(".first"))
    await loadRemoteSiteRules()
    expect(getActiveBuiltInSiteRules().map((rule) => rule.id)).toEqual(["remote"])
    expect(getEffectiveSiteRule(config, RULE_URL).excludeSelector).toBe(".first")

    const listener = vi.fn<() => void>()
    const unsubscribe = subscribeActiveBuiltInSiteRules(listener)
    await setStoredRemoteSiteRules(storedRules(".second", { revision: 200 }))
    await vi.waitFor(() => expect(listener).toHaveBeenCalled())
    unsubscribe()

    // Same config object: the memo must not hand back the old resolution.
    expect(getEffectiveSiteRule(config, RULE_URL).excludeSelector).toBe(".second")
  })

  it("ignore a document published before this build's release", () => {
    setRemoteSiteRulesDocument(storedRules(".remote", { extensionVersion: "1.58.0" }))
    expect(getActiveBuiltInSiteRules()).toBe(BUILT_IN_SITE_RULES)
  })

  it("can be switched off one by one like any built-in rule", () => {
    setRemoteSiteRulesDocument(storedRules(".remote"))
    const config = freshConfig()
    config.siteRules = { userRules: [], disabledBuiltInRules: ["remote"] }

    expect(getEffectiveSiteRule(config, RULE_URL).excludeSelector).toBeNull()
  })
})
