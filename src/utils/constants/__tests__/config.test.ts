import { afterEach, describe, expect, it, vi } from "vitest"

describe("dEFAULT_CONFIG", () => {
  const originalCrypto = globalThis.crypto

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    })
    vi.resetModules()
  })

  it("initializes when crypto.randomUUID is unavailable but crypto.getRandomValues exists", async () => {
    const getRandomValues = vi.fn<(...args: any[]) => any>((array: Uint8Array<ArrayBuffer>) =>
      originalCrypto.getRandomValues(array),
    )

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues,
      },
    })
    vi.resetModules()

    const { DEFAULT_CONFIG } = await import("../config")
    const defaultDictionaryAction = DEFAULT_CONFIG.selectionToolbar.customActions[0]

    expect(defaultDictionaryAction).toEqual(
      expect.objectContaining({
        id: "default-dictionary",
      }),
    )
    expect(defaultDictionaryAction?.outputSchema).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "default-dictionary-term" })]),
    )
    expect(
      defaultDictionaryAction?.outputSchema.every(
        (field) => typeof field.id === "string" && field.id.length > 0,
      ),
    ).toBe(true)
    expect(getRandomValues).toHaveBeenCalled()
  })

  it("seeds default translation providers and the default LLM providers in the default providers config", async () => {
    const { DEFAULT_CONFIG } = await import("../config")
    const { configSchema } = await import("@/types/config/config")

    const parseResult = configSchema.safeParse(DEFAULT_CONFIG)
    if (!parseResult.success) {
      console.error(parseResult.error.issues)
    }

    expect(parseResult.success).toBe(true)
    expect(DEFAULT_CONFIG.providersConfig.map((provider) => provider.id)).toEqual([
      "microsoft-translate-default",
      "google-translate-default",
      "openai-default",
      "deepseek-default",
      "atlascloud-default",
    ])
    expect(DEFAULT_CONFIG.translate.providerId).toBe("microsoft-translate-default")
    expect(DEFAULT_CONFIG.selectionToolbar.features.translate.providerId).toBe(
      "microsoft-translate-default",
    )
    expect(DEFAULT_CONFIG.inputTranslation.providerId).toBe("microsoft-translate-default")
    expect(DEFAULT_CONFIG.videoSubtitles.providerId).toBe("microsoft-translate-default")
    expect(
      DEFAULT_CONFIG.providersConfig.find((provider) => provider.id === "deepseek-default"),
    ).toEqual(
      expect.objectContaining({
        model: {
          model: "deepseek-v4-flash",
          isCustomModel: false,
          customModel: null,
        },
      }),
    )
    expect(
      DEFAULT_CONFIG.providersConfig.find((provider) => provider.id === "atlascloud-default"),
    ).toEqual(
      expect.objectContaining({
        model: {
          model: "deepseek-ai/deepseek-v4-flash",
          isCustomModel: false,
          customModel: null,
        },
      }),
    )
  })

  it("rebuilds schema-valid default custom actions for persistence", async () => {
    const { buildFreshDefaultConfig, DEFAULT_CONFIG } = await import("../config")
    const { configSchema } = await import("@/types/config/config")

    const config = buildFreshDefaultConfig()

    expect(config).not.toBe(DEFAULT_CONFIG)
    expect(config.selectionToolbar.customActions).not.toBe(
      DEFAULT_CONFIG.selectionToolbar.customActions,
    )
    expect(config.selectionToolbar.customActions[0]).toEqual(
      expect.objectContaining({
        id: "default-dictionary",
        name: expect.any(String),
        systemPrompt: expect.any(String),
        prompt: expect.any(String),
      }),
    )
    expect(configSchema.safeParse(config).success).toBe(true)
  })
})
