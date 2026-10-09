import { afterEach, describe, expect, it, vi } from "vitest"
// Warm config's module graph at collection time, which has no timeout. Each test
// still re-imports it after vi.resetModules(), but no longer pays the cold load
// inside its 5s budget.
import "../config"

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

    const { createDefaultDictionaryAction, createDefaultSentenceAnalysisAction, DEFAULT_CONFIG } =
      await import("../config")
    const defaultDictionaryAction = createDefaultDictionaryAction()
    const defaultSentenceAnalysisAction = createDefaultSentenceAnalysisAction()

    expect(defaultDictionaryAction).toEqual(
      expect.objectContaining({
        id: "default-dictionary",
        icon: "streamline-color:dictionary-language-book-flat",
      }),
    )
    expect(defaultSentenceAnalysisAction).toEqual(
      expect.objectContaining({
        id: "default-sentence-analysis",
        icon: "streamline-color:search-visual-flat",
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
    // Google leads deliberately: the deletion fallback takes the first usable provider in this
    // order, and landing page translation on Microsoft is illegal in translationOnly mode
    // (see DEFAULT_PROVIDER_CONFIG_LIST).
    expect(DEFAULT_CONFIG.providersConfig.map((provider) => provider.id)).toEqual([
      "google-translate-default",
      "microsoft-translate-default",
      "openai-default",
      "jalapenocloud-default",
      "deepseek-default",
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
          model: "GLM-5.2",
          isCustomModel: false,
          customModel: null,
        },
      }),
    )
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

describe("createDefaultDictionaryAction layout", () => {
  it("is the dictionary card built for the renamed field ids", async () => {
    const { createDefaultDictionaryAction } = await import("../config")
    const { buildDictionaryActionLayout } = await import("@/utils/layout-host/slots")

    const action = createDefaultDictionaryAction()

    expect(action?.layout).toEqual(expect.any(String))
    expect(action?.layout).toBe(buildDictionaryActionLayout(action?.outputSchema ?? []))
    expect(action?.layout).toContain("default-dictionary-term")
  })

  it("places every field exactly once, leaving the card's tail empty", async () => {
    const { createDefaultDictionaryAction } = await import("../config")
    const { compileLayout, renderLayoutHtml } = await import("@read-frog/layout-engine/core")
    const { buildCustomActionLayoutScope } = await import("@/utils/layout-host/host")
    const { getDictionarySlots } = await import("@/utils/layout-host/slots")

    const action = createDefaultDictionaryAction()
    if (!action?.layout) throw new Error("expected the built-in Dictionary to carry a layout")
    const compiled = compileLayout(action.layout)
    if (!compiled.ok) throw compiled.error

    const value: Record<string, string> = Object.fromEntries(
      action.outputSchema.map((field, index) => [field.name, `value ${index}`]),
    )
    // The term's quotes are not shown as text: they mark the sentence.
    const slots = getDictionarySlots(action.outputSchema)
    const sentence = value[slots.context?.name ?? ""]
    const termName = slots.contextTerm?.name ?? ""
    value[termName] = JSON.stringify([{ text: sentence }])
    const html = renderLayoutHtml(
      compiled.compiled,
      buildCustomActionLayoutScope({
        outputSchema: action.outputSchema,
        value,
        selection: "blossom",
        targetCode: "cmn",
        status: "done",
      }),
    )
    // Text between tags: the headword is also in its button's data-speak,
    // which is an attribute and not counted.
    const textRuns = html.split(/<[^>]*>/).map((run) => run.trim())

    expect(action.outputSchema).toHaveLength(9)
    for (const [name, shown] of Object.entries(value)) {
      if (name === termName) continue
      expect(textRuns.filter((run) => run === shown)).toHaveLength(1)
    }
    expect(html).toContain(`<b class="rf-d-mark">${sentence}</b>`)
    expect(html).not.toContain('class="rf-field"')
  })
})
