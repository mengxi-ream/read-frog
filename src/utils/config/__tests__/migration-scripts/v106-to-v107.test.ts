import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrate } from "../../migration-scripts/v106-to-v107"
import { testSeries as v106TestSeries } from "../example/v106"

function perplexityProvider(model: any): any {
  return {
    id: "perplexity-default",
    name: "Perplexity",
    enabled: true,
    provider: "perplexity",
    apiKey: "pplx-key",
    model,
  }
}

describe("v106-to-v107 migration", () => {
  it.each([
    ["sonar", "perplexity/sonar"],
    ["sonar-pro", "low"],
    ["sonar-reasoning", "medium"],
    ["sonar-reasoning-pro", "medium"],
    ["sonar-deep-research", "high"],
  ])("moves the Perplexity %s model to %s", (oldModel, newModel) => {
    const migrated = migrate({
      providersConfig: [
        perplexityProvider({ model: oldModel, isCustomModel: false, customModel: null }),
      ],
    })

    expect(migrated.providersConfig[0]).toEqual(
      perplexityProvider({ model: newModel, isCustomModel: false, customModel: null }),
    )
  })

  it("moves a Perplexity custom model that is a Sonar id, and keeps any other custom model", () => {
    const migrated = migrate({
      providersConfig: [
        perplexityProvider({ model: "sonar", isCustomModel: true, customModel: "sonar-pro" }),
        {
          ...perplexityProvider({
            model: "sonar",
            isCustomModel: true,
            customModel: "openai/gpt-5.4",
          }),
          id: "perplexity-custom",
        },
      ],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "perplexity/sonar",
      isCustomModel: true,
      customModel: "low",
    })
    expect(migrated.providersConfig[1].model).toEqual({
      model: "perplexity/sonar",
      isCustomModel: true,
      customModel: "openai/gpt-5.4",
    })
  })

  it("falls back to perplexity/sonar for a Perplexity model it does not know", () => {
    const migrated = migrate({
      providersConfig: [
        perplexityProvider({ model: "r1-1776", isCustomModel: false, customModel: null }),
      ],
    })

    expect(migrated.providersConfig[0].model.model).toBe("perplexity/sonar")
  })

  it("converts a Vercel provider to an OpenAI-compatible custom provider", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "vercel-default",
          name: "Vercel",
          enabled: true,
          provider: "vercel",
          apiKey: "v0-key",
          temperature: 0.2,
          model: { model: "v0-1.5-md", isCustomModel: false, customModel: null },
        },
      ],
    })

    expect(migrated.providersConfig[0]).toEqual({
      id: "vercel-default",
      name: "Vercel",
      enabled: true,
      provider: "openai-compatible",
      apiKey: "v0-key",
      baseURL: "https://api.v0.dev/v1",
      temperature: 0.2,
      model: { model: "use-custom-model", isCustomModel: true, customModel: "v0-1.5-md" },
    })
  })

  it("keeps a Vercel provider's own base URL and custom model", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "vercel-proxy",
          name: "My v0",
          enabled: false,
          provider: "vercel",
          baseURL: "https://proxy.example/v1",
          model: { model: "v0-1.5-lg", isCustomModel: true, customModel: "v0-1.0-md" },
        },
      ],
    })

    expect(migrated.providersConfig[0]).toMatchObject({
      provider: "openai-compatible",
      baseURL: "https://proxy.example/v1",
      model: { model: "use-custom-model", isCustomModel: true, customModel: "v0-1.0-md" },
    })
  })

  it("is idempotent and leaves other providers untouched", () => {
    const openAIProvider = {
      id: "openai-default",
      name: "OpenAI",
      enabled: true,
      provider: "openai",
      model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
    }
    const once = migrate({
      providersConfig: [
        openAIProvider,
        perplexityProvider({ model: "sonar-pro", isCustomModel: false, customModel: null }),
        {
          id: "vercel-default",
          name: "Vercel",
          enabled: true,
          provider: "vercel",
          model: { model: "v0-1.5-md", isCustomModel: false, customModel: null },
        },
      ],
    })
    const twice = migrate(once)

    expect(twice).toEqual(once)
    expect(twice.providersConfig[0]).toBe(openAIProvider)
    expect(twice.providersConfig[1]).toBe(once.providersConfig[1])
  })

  it("produces a config the current schema accepts", () => {
    const config = structuredClone(v106TestSeries["complex-config-from-v020"]!.config)
    config.providersConfig.push(
      perplexityProvider({ model: "sonar-deep-research", isCustomModel: false, customModel: null }),
      {
        id: "vercel-default",
        name: "Vercel",
        enabled: true,
        provider: "vercel",
        model: { model: "v0-1.5-md", isCustomModel: false, customModel: null },
      },
    )

    const result = configSchema.safeParse(migrate(config))
    if (!result.success) {
      console.error(result.error.issues)
    }
    expect(result.success).toBe(true)
  })

  it("preserves malformed config shapes as much as possible", () => {
    expect(migrate({})).toEqual({})
    expect(migrate({ providersConfig: null })).toEqual({ providersConfig: null })
    expect(migrate({ providersConfig: ["bad-provider"] })).toEqual({
      providersConfig: ["bad-provider"],
    })
    expect(migrate({ providersConfig: [{ provider: "perplexity" }] })).toEqual({
      providersConfig: [{ provider: "perplexity" }],
    })
  })
})
