import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { GOOGLE_TRANSLATE_PROVIDER_ID } from "@/utils/constants/providers"
import {
  getTranslationOnlyBlockedReason,
  providerSupportsTranslationOnlyMode,
} from "../translation-only-gate"

// `@/utils/i18n` is globally mocked to echo the key, so the reason's wording is
// unassertable here — only whether one is produced. The rendered sentence is
// verified in the browser.

describe("providerSupportsTranslationOnlyMode", () => {
  it("refuses the providers whose endpoint cannot preserve markup", () => {
    expect(providerSupportsTranslationOnlyMode("microsoft-translate")).toBe(false)
  })

  it("allows every provider not on that list", () => {
    expect(providerSupportsTranslationOnlyMode("google-translate")).toBe(true)
    expect(providerSupportsTranslationOnlyMode("deeplx")).toBe(true)
  })
})

describe("getTranslationOnlyBlockedReason", () => {
  it("blocks a fresh profile, which ships on Microsoft", () => {
    expect(getTranslationOnlyBlockedReason(DEFAULT_CONFIG)).not.toBeNull()
  })

  it("clears once page translation moves to a provider that keeps markup", () => {
    const config = {
      ...DEFAULT_CONFIG,
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
        providerId: GOOGLE_TRANSLATE_PROVIDER_ID,
      },
    }

    expect(getTranslationOnlyBlockedReason(config)).toBeNull()
  })

  it("stays out of the way when the assigned provider no longer exists", () => {
    const config = {
      ...DEFAULT_CONFIG,
      pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, providerId: "deleted-provider" },
    }

    expect(getTranslationOnlyBlockedReason(config)).toBeNull()
  })
})
