import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v117-to-v118"

const BUILT_IN_AI = "read-frog-free-ai"

function provider(id: string, type: string, apiKey?: string) {
  return { id, name: id, enabled: true, provider: type, ...(apiKey !== undefined && { apiKey }) }
}

function configWith({
  providersConfig,
  builtInProviderId = BUILT_IN_AI,
  customProviderIds = [],
}: {
  providersConfig: unknown[]
  builtInProviderId?: string
  customProviderIds?: string[]
}) {
  return {
    providersConfig,
    selectionToolbar: {
      enabled: true,
      builtInActions: {
        dictionary: { enabled: true, providerId: builtInProviderId },
        sentenceAnalysis: { enabled: true, providerId: BUILT_IN_AI },
        improveWriting: { enabled: false, providerId: builtInProviderId },
      },
      customActions: customProviderIds.map((providerId, index) => ({
        id: `action-${index}`,
        name: `Action ${index}`,
        providerId,
        prompt: "Explain {{selection}}",
      })),
    },
  }
}

describe("v117-to-v118 migration", () => {
  it("moves built-in and custom actions off a provider that has no key", () => {
    const oldConfig = configWith({
      providersConfig: [provider("openai-default", "openai"), provider("ds", "deepseek", "sk-ds")],
      builtInProviderId: "openai-default",
      customProviderIds: ["openai-default", "ds"],
    })
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.selectionToolbar.builtInActions).toEqual({
      dictionary: { enabled: true, providerId: BUILT_IN_AI },
      sentenceAnalysis: { enabled: true, providerId: BUILT_IN_AI },
      improveWriting: { enabled: false, providerId: BUILT_IN_AI },
    })
    expect(migrated.selectionToolbar.customActions.map((a: any) => a.providerId)).toEqual([
      BUILT_IN_AI,
      "ds",
    ])
    // Everything but the provider id is kept.
    expect(migrated.selectionToolbar.customActions[0]).toEqual({
      ...oldConfig.selectionToolbar.customActions[0],
      providerId: BUILT_IN_AI,
    })
    expect(migrated.providersConfig).toBe(oldConfig.providersConfig)
    expect(migrated.selectionToolbar.enabled).toBe(true)
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("treats an empty or whitespace-only key as no key", () => {
    const migrated = migrate(
      configWith({
        providersConfig: [provider("a", "anthropic", ""), provider("o", "openrouter", "  ")],
        customProviderIds: ["a", "o"],
      }),
    )

    expect(migrated.selectionToolbar.customActions.map((a: any) => a.providerId)).toEqual([
      BUILT_IN_AI,
      BUILT_IN_AI,
    ])
  })

  it("keeps providers that have a key", () => {
    const config = configWith({
      providersConfig: [provider("openai-default", "openai", "sk-1")],
      builtInProviderId: "openai-default",
      customProviderIds: ["openai-default"],
    })

    expect(migrate(config)).toBe(config)
  })

  it.each(["ollama", "openai-compatible", "open-responses"])(
    "keeps %s, which can run without a key",
    (type) => {
      const config = configWith({
        providersConfig: [provider("local", type)],
        builtInProviderId: "local",
        customProviderIds: ["local"],
      })

      expect(migrate(config)).toBe(config)
    },
  )

  it("only moves what needs moving", () => {
    const oldConfig = configWith({
      providersConfig: [provider("openai-default", "openai")],
      customProviderIds: ["openai-default"],
    })

    const migrated = migrate(oldConfig)

    // Built-in actions were already on the Built-in AI: same object.
    expect(migrated.selectionToolbar.builtInActions).toBe(oldConfig.selectionToolbar.builtInActions)
    expect(migrated.selectionToolbar.customActions[0].providerId).toBe(BUILT_IN_AI)
  })

  it("leaves actions on a provider that is not configured", () => {
    const config = configWith({
      providersConfig: [provider("openai-default", "openai")],
      customProviderIds: ["deleted-provider"],
    })

    expect(migrate(config)).toBe(config)
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    const noToolbar = { providersConfig: [provider("o", "openai")] }
    expect(migrate(noToolbar)).toBe(noToolbar)
    const badShapes = {
      providersConfig: [provider("o", "openai"), null, "x"],
      selectionToolbar: { builtInActions: null, customActions: [null, { providerId: 1 }] },
    }
    expect(migrate(badShapes)).toBe(badShapes)
  })
})
