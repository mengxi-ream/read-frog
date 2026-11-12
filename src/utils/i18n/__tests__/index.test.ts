import { beforeEach, describe, expect, it, vi } from "vitest"

// vitest.setup.ts swaps the facade for a key-echoing stub. This file tests the real one,
// against a few hand-written resources because vitest can't load the .yml locale files.
vi.unmock("@/utils/i18n")

vi.mock("@/utils/i18n/resources", async () => ({
  ...(await vi.importActual<typeof import("@/utils/i18n/locales")>("@/utils/i18n/locales")),
  resources: {
    en: {
      translation: {
        noAPIKeyConfig: { warningWithLink: { page: "page" } },
        options: {
          preference: {
            config: { googleDrive: { unresolved: { progress: "Resolved {{0}}/{{1}} changes" } } },
          },
          selectionToolbar: {
            customActions: {
              templates: {
                dictionary: { prompt: "Explain {{selection}} in {{targetLanguage}}." },
              },
            },
          },
        },
      },
    },
    ru: {
      translation: {
        noAPIKeyConfig: { warningWithLink: { page: "" } },
      },
    },
  },
}))

const { i18n, initI18n, setUiLanguage } = await import("@/utils/i18n")

describe("i18n.t", () => {
  beforeEach(async () => {
    await initI18n("en")
    await setUiLanguage("en")
  })

  it("keeps a sentence fragment a locale leaves empty instead of filling it in from English", async () => {
    await setUiLanguage("ru")
    expect(i18n.t("noAPIKeyConfig.warningWithLink.page")).toBe("")
  })

  it("fills positional substitutions in order", () => {
    expect(i18n.t("options.preference.config.googleDrive.unresolved.progress", [2, 5])).toBe(
      "Resolved 2/5 changes",
    )
  })

  it("leaves prompt-template tokens untouched when called without substitutions", () => {
    expect(i18n.t("options.selectionToolbar.customActions.templates.dictionary.prompt")).toBe(
      "Explain {{selection}} in {{targetLanguage}}.",
    )
  })

  it("returns an empty string for a key missing in every locale", () => {
    expect(i18n.t("noAPIKeyConfig.warning")).toBe("")
  })
})
