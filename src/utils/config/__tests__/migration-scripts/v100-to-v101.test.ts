import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v100-to-v101"

/**
 * A stored v100 config carrying one of every pattern shape a user could have
 * ended up with. Typed `any` like the migration it feeds — this is a stored
 * shape, not the current schema.
 */
function configWithPatterns(): any {
  return {
    uiLanguage: "zh-CN",
    pageTranslation: {
      page: {
        autoTranslatePatterns: [
          "example.com", // bare host: the only shape that changes
          "  Example.COM  ", // trimmed and lowercased on the way in
          "*.already.com", // already a pattern
          "example.com/docs", // carries a path
          "localhost:5173", // carries a port, which the matcher rejects either way
          "",
        ],
        neverAutoTranslatePatterns: ["never.com"],
        shortcut: "Alt+B",
      },
    },
    siteControl: {
      mode: "blacklist",
      blacklistPatterns: ["blocked.com"],
      whitelistPatterns: [],
    },
    floatingButton: { enabled: true, disabledFloatingButtonPatterns: ["github.com"] },
    selectionToolbar: { enabled: true, disabledSelectionToolbarPatterns: ["docs.google.com"] },
  }
}

describe("v100 to v101 migration", () => {
  it("adds the glossary section enabled", () => {
    expect(migrate(configWithPatterns()).glossary).toEqual({ enabled: true })
  })

  it("keeps an existing glossary section rather than resetting it", () => {
    const stored = { ...configWithPatterns(), glossary: { enabled: false } }
    expect(migrate(stored).glossary).toEqual({ enabled: false })
  })

  it("rewrites only bare hosts, so each pattern keeps what it used to match", () => {
    expect(migrate(configWithPatterns()).pageTranslation.page.autoTranslatePatterns).toEqual([
      "*.example.com",
      "*.example.com",
      "*.already.com",
      "example.com/docs",
      "localhost:5173",
      "",
    ])
  })

  it("covers every website list, not just auto-translate", () => {
    const migrated = migrate(configWithPatterns())

    expect(migrated.pageTranslation.page.neverAutoTranslatePatterns).toEqual(["*.never.com"])
    expect(migrated.siteControl.blacklistPatterns).toEqual(["*.blocked.com"])
    expect(migrated.siteControl.whitelistPatterns).toEqual([])
    expect(migrated.floatingButton.disabledFloatingButtonPatterns).toEqual(["*.github.com"])
    expect(migrated.selectionToolbar.disabledSelectionToolbarPatterns).toEqual([
      "*.docs.google.com",
    ])
  })

  it("leaves everything else untouched", () => {
    const before = configWithPatterns()
    const migrated = migrate(before)

    expect(migrated.uiLanguage).toBe("zh-CN")
    expect(migrated.pageTranslation.page.shortcut).toBe("Alt+B")
    expect(migrated.siteControl.mode).toBe("blacklist")
    expect(migrated.floatingButton.enabled).toBe(true)
  })

  it("is idempotent, so a re-run cannot double-prefix a host", () => {
    const once = migrate(configWithPatterns())
    expect(migrate(once)).toEqual(once)
  })

  /** A config written before one of these sections existed must not throw. */
  it("tolerates missing or malformed sections", () => {
    expect(migrate({ uiLanguage: "en" })).toEqual({ uiLanguage: "en", glossary: { enabled: true } })
    expect(migrate({ siteControl: { blacklistPatterns: "not-an-array" } }).siteControl).toEqual({
      blacklistPatterns: "not-an-array",
      whitelistPatterns: undefined,
    })
    expect(migrate(null)).toBeNull()
    expect(migrate("nonsense")).toBe("nonsense")
  })
})
