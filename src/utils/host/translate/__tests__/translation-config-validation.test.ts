// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { validateTranslationConfigAndToast } from "../translate-text"

vi.mock("@/utils/message", () => ({ sendMessage: vi.fn<() => void>() }))
vi.mock("@/components/ui/base-ui/toast", () => ({ toastManager: { add: vi.fn<() => void>() } }))

describe("page translation API key validation", () => {
  it.each([undefined, "", "   "])("allows Bilibili with key %j", (apiKey) => {
    const provider = { ...DEFAULT_PROVIDER_CONFIG["bilibili-translate"], apiKey }
    expect(
      validateTranslationConfigAndToast({
        providersConfig: [provider],
        pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, providerId: provider.id },
        language: { ...DEFAULT_CONFIG.language, sourceCode: "eng", targetCode: "cmn" },
      }),
    ).toBe(true)
  })

  it("still rejects OpenAI without a key", () => {
    const provider = { ...DEFAULT_PROVIDER_CONFIG.openai, apiKey: "" }
    expect(
      validateTranslationConfigAndToast({
        providersConfig: [provider],
        pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, providerId: provider.id },
        language: { ...DEFAULT_CONFIG.language, sourceCode: "eng", targetCode: "cmn" },
      }),
    ).toBe(false)
  })
})
