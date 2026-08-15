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

    const { createDefaultDictionaryAction, DEFAULT_CONFIG } = await import("../config")
    const defaultDictionaryAction = createDefaultDictionaryAction()

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
    expect(DEFAULT_CONFIG.selectionToolbar.customActions).toEqual([])
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
      "jalapenocloud-default",
      "atlascloud-default",
    ])
    expect(DEFAULT_CONFIG.pageTranslation.providerId).toBe("microsoft-translate-default")
    expect(DEFAULT_CONFIG.selectionToolbar.features.translate.providerId).toBe(
      "microsoft-translate-default",
    )
    expect(DEFAULT_CONFIG.inputTranslation.providerId).toBe("microsoft-translate-default")
    expect(DEFAULT_CONFIG.videoSubtitles.providerId).toBe("microsoft-translate-default")
    expect(
      DEFAULT_CONFIG.providersConfig.find((provider) => provider.id === "jalapenocloud-default"),
    ).toEqual(
      expect.objectContaining({
        model: {
          model: "DeepSeek-V4-Flash",
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

  it("defaults fresh hover translation off", async () => {
    const { DEFAULT_CONFIG } = await import("../config")

    expect(DEFAULT_CONFIG.pageTranslation.node.forceRetranslation).toBe(false)
  })

  it("keeps pre-v090 config parseable until the background migration runs", async () => {
    const { DEFAULT_CONFIG } = await import("../config")
    const { configSchema } = await import("@/types/config/config")
    const legacyConfig = structuredClone(DEFAULT_CONFIG)
    const legacyNode = legacyConfig.pageTranslation.node as Partial<
      typeof legacyConfig.pageTranslation.node
    >

    delete legacyNode.forceRetranslation
    legacyConfig.language.targetCode = "jpn"

    const result = configSchema.safeParse(legacyConfig)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.pageTranslation.node.forceRetranslation).toBe(false)
    expect(result.data.language.targetCode).toBe("jpn")
  })

  it("rebuilds schema-valid built-in action state for persistence", async () => {
    const { buildFreshDefaultConfig, createDefaultDictionaryAction, DEFAULT_CONFIG } =
      await import("../config")
    const { configSchema } = await import("@/types/config/config")

    const config = buildFreshDefaultConfig()

    expect(config).not.toBe(DEFAULT_CONFIG)
    expect(config.selectionToolbar.customActions).not.toBe(
      DEFAULT_CONFIG.selectionToolbar.customActions,
    )
    expect(config.selectionToolbar.builtInActions.dictionary).toEqual({
      enabled: true,
      providerId: "read-frog-free-ai",
    })
    expect(config.selectionToolbar.customActions).toEqual([])
    expect(createDefaultDictionaryAction()).toEqual(
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
