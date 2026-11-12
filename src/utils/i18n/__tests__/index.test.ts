import { beforeEach, describe, expect, it, vi } from "vitest"

// vitest.setup.ts replaces the facade with a key-echoing stub; this file tests the real one.
vi.unmock("@/utils/i18n")

vi.mock("@/utils/i18n/resources", async () => ({
  ...(await vi.importActual<typeof import("@/utils/i18n/locales")>("@/utils/i18n/locales")),
  resources: {
    en: {
      translation: {
        noAPIKeyConfig: { warningWithLink: { firstOnThe: "first on the" } },
        options: { batchSavings: { savedCost: "Saved {{0}}" } },
      },
    },
    tr: {
      translation: {
        noAPIKeyConfig: { warningWithLink: { firstOnThe: "" } },
      },
    },
  },
}))

const { i18n, initI18n, setUiLanguage } = await import("@/utils/i18n")

describe("i18n facade", () => {
  beforeEach(async () => {
    await initI18n("en")
    await setUiLanguage("en")
  })

  it("keeps an empty translation empty instead of falling back to English", async () => {
    await setUiLanguage("tr")
    expect(i18n.t("noAPIKeyConfig.warningWithLink.firstOnThe")).toBe("")
  })

  it("fills positional substitutions", () => {
    expect(i18n.t("options.batchSavings.savedCost", ["$3"])).toBe("Saved $3")
  })

  it("returns an empty string for a key missing in every locale", () => {
    expect(i18n.t("noAPIKeyConfig.warningWithLink.page")).toBe("")
  })
})
