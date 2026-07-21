import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v086-to-v087"

describe("v086-to-v087 migration", () => {
  it("splits legacy block selectors into node and style fields and moves inline selectors to style", () => {
    const migrated = migrate({
      siteRules: {
        disabledBuiltInRules: ["disabled-built-in"],
        userRules: [
          {
            id: "legacy",
            matches: "example.com",
            forceBlockSelectors: [".block"],
            "forceBlockSelectors.add": [".block-added"],
            "forceBlockSelectors.remove": [".block-removed"],
            forceInlineSelectors: [".inline"],
            "forceInlineSelectors.add": [".inline-added"],
            "forceInlineSelectors.remove": [".inline-removed"],
          },
        ],
      },
    })

    expect(migrated.siteRules).toEqual({
      disabledBuiltInRules: ["disabled-built-in"],
      userRules: [
        {
          id: "legacy",
          matches: "example.com",
          forceBlockNodeSelectors: [".block"],
          "forceBlockNodeSelectors.add": [".block-added"],
          "forceBlockNodeSelectors.remove": [".block-removed"],
          forceBlockStyleSelectors: [".block"],
          "forceBlockStyleSelectors.add": [".block-added"],
          "forceBlockStyleSelectors.remove": [".block-removed"],
          forceInlineStyleSelectors: [".inline"],
          "forceInlineStyleSelectors.add": [".inline-added"],
          "forceInlineStyleSelectors.remove": [".inline-removed"],
        },
      ],
    })
    expect(migrated.siteRules.userRules[0]).not.toHaveProperty("forceInlineNodeSelectors")
  })

  it("keeps explicitly authored new values per corresponding key and deletes every old key", () => {
    const migrated = migrate({
      siteRules: {
        userRules: [
          {
            id: "mixed",
            matches: "example.com",
            forceBlockSelectors: [".old-block"],
            "forceBlockSelectors.add": [".old-block-add"],
            "forceBlockSelectors.remove": [".old-block-remove"],
            forceBlockNodeSelectors: [".new-block-node"],
            "forceBlockNodeSelectors.remove": [".new-block-node-remove"],
            "forceBlockStyleSelectors.add": [".new-block-style-add"],
            forceInlineSelectors: [".old-inline"],
            "forceInlineSelectors.add": [".old-inline-add"],
            "forceInlineSelectors.remove": [".old-inline-remove"],
            forceInlineNodeSelectors: [".new-inline-node"],
            forceInlineStyleSelectors: [".new-inline-style"],
            "forceInlineStyleSelectors.remove": [".new-inline-style-remove"],
          },
        ],
        disabledBuiltInRules: [],
      },
    })
    const rule = migrated.siteRules.userRules[0]

    expect(rule).toMatchObject({
      forceBlockNodeSelectors: [".new-block-node"],
      "forceBlockNodeSelectors.add": [".old-block-add"],
      "forceBlockNodeSelectors.remove": [".new-block-node-remove"],
      forceBlockStyleSelectors: [".old-block"],
      "forceBlockStyleSelectors.add": [".new-block-style-add"],
      "forceBlockStyleSelectors.remove": [".old-block-remove"],
      forceInlineNodeSelectors: [".new-inline-node"],
      forceInlineStyleSelectors: [".new-inline-style"],
      "forceInlineStyleSelectors.add": [".old-inline-add"],
      "forceInlineStyleSelectors.remove": [".new-inline-style-remove"],
    })
    for (const oldKey of [
      "forceBlockSelectors",
      "forceBlockSelectors.add",
      "forceBlockSelectors.remove",
      "forceInlineSelectors",
      "forceInlineSelectors.add",
      "forceInlineSelectors.remove",
    ]) {
      expect(rule).not.toHaveProperty(oldKey)
    }
  })

  it("does not mutate its input, preserves unrelated fields, and is idempotent", () => {
    const oldConfig = {
      uiLanguage: "ja",
      siteRules: {
        disabledBuiltInRules: ["built-in"],
        userRules: [
          {
            id: "preserve",
            description: "Unrelated fields survive",
            matches: ["example.com"],
            excludeSelectors: [".advertisement"],
            forceBlockSelectors: [".legacy"],
          },
        ],
      },
    }
    const snapshot = structuredClone(oldConfig)

    const first = migrate(oldConfig)
    const second = migrate(first)

    expect(oldConfig).toEqual(snapshot)
    expect(first).toMatchObject({
      uiLanguage: "ja",
      siteRules: {
        disabledBuiltInRules: ["built-in"],
        userRules: [
          {
            id: "preserve",
            description: "Unrelated fields survive",
            matches: ["example.com"],
            excludeSelectors: [".advertisement"],
          },
        ],
      },
    })
    expect(second).toEqual(first)
  })

  it("leaves malformed shapes safe and preserves non-object rule entries", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate(undefined)).toBeUndefined()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ siteRules: null })).toEqual({ siteRules: null })
    expect(migrate({ siteRules: [] })).toEqual({ siteRules: [] })
    expect(migrate({ siteRules: { userRules: null } })).toEqual({
      siteRules: { userRules: null },
    })

    const malformedRules = [null, "bad-rule", ["bad-array"]]
    expect(migrate({ siteRules: { userRules: malformedRules } })).toEqual({
      siteRules: { userRules: malformedRules },
    })
  })
})
