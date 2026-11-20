import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  getBuiltInAiModelId,
  getBuiltInAiProviderId,
  isBuiltInAiProviderId,
} from "@/utils/constants/provider-ids"
import { LUNA_PROVIDER_ID, testHostedAiModels } from "@/utils/hosted-ai/__tests__/test-models"
import { sanitizeHostedAiModels } from "@/utils/hosted-ai/models"
import {
  doesProviderSupportsCapability,
  getBuiltInAiSelectorItems,
  getProviderIdsForCapability,
  getSelectableProvidersForCapability,
  resolveProviderRefForCapability,
} from "../provider-registry"

const MODELS = sanitizeHostedAiModels(testHostedAiModels())!

describe("Built-in AI provider ids", () => {
  it("names one provider per model", () => {
    expect(getBuiltInAiProviderId("gpt-6.2-sol")).toBe("read-frog-ai:gpt-6.2-sol")
    expect(getBuiltInAiModelId("read-frog-ai:gpt-6.2-sol")).toBe("gpt-6.2-sol")
    expect(isBuiltInAiProviderId(LUNA_PROVIDER_ID)).toBe(true)
  })

  it("rejects the old tier ids and malformed model ids", () => {
    expect(isBuiltInAiProviderId("read-frog-free-ai")).toBe(false)
    expect(isBuiltInAiProviderId("read-frog-advance-ai")).toBe(false)
    expect(isBuiltInAiProviderId("read-frog-ai:")).toBe(false)
    expect(isBuiltInAiProviderId("read-frog-ai: gpt-6-luna")).toBe(false)
    expect(isBuiltInAiProviderId(`read-frog-ai:${"x".repeat(65)}`)).toBe(false)
    expect(getBuiltInAiModelId("openai-default")).toBeNull()
  })

  it("reads no model from a missing id, which stored configs can hold", () => {
    expect(getBuiltInAiModelId(null)).toBeNull()
    expect(isBuiltInAiProviderId(undefined)).toBe(false)
    expect(
      resolveProviderRefForCapability(
        "videoSubtitles",
        DEFAULT_CONFIG.providersConfig,
        null as unknown as string,
      ),
    ).toBeNull()
  })
})

describe("getBuiltInAiSelectorItems", () => {
  it("offers every model in the server's order", () => {
    const items = getBuiltInAiSelectorItems(MODELS)

    expect(items.map((item) => [item.name, item.tier, item.available])).toEqual([
      ["Claude Haiku 5.5", "normal", true],
      ["GPT-6 Luna", "normal", true],
      ["DeepSeek V4.1 Flash", "normal", true],
      ["GPT-6.2 Sol", "advance", true],
      ["Claude Sonnet 5.5", "advance", true],
    ])
  })

  it("keeps a selected model the list dropped, marked unavailable", () => {
    const items = getBuiltInAiSelectorItems(MODELS, [
      "read-frog-ai:gpt-5-mini",
      "openai-default",
      LUNA_PROVIDER_ID,
    ])

    expect(items).toHaveLength(6)
    expect(items.at(-1)).toMatchObject({
      id: "read-frog-ai:gpt-5-mini",
      name: "gpt-5-mini",
      available: false,
    })
  })

  it("offers the default model and the selected ones, availability unknown, with no list", () => {
    const items = getBuiltInAiSelectorItems(null, ["read-frog-ai:gpt-6.2-sol"])

    expect(items.map((item) => [item.id, item.available])).toEqual([
      [LUNA_PROVIDER_ID, undefined],
      ["read-frog-ai:gpt-6.2-sol", undefined],
    ])
  })
})

describe("capabilities and resolution", () => {
  const providersConfig = DEFAULT_CONFIG.providersConfig

  it("accepts any well-formed model id, listed or not, so a config never fails to parse", () => {
    expect(
      doesProviderSupportsCapability("pageTranslation", providersConfig, "read-frog-ai:gpt-5-mini"),
    ).toBe(true)
    expect(
      doesProviderSupportsCapability("customAction", providersConfig, "read-frog-free-ai"),
    ).toBe(false)
  })

  it("lists the models after the user's providers", () => {
    const ids = getProviderIdsForCapability("customAction", [], { builtInAiModels: MODELS })

    expect(ids).toEqual(MODELS.map((model) => getBuiltInAiProviderId(model.id)))
  })

  it("resolves a model with its display name when the list is at hand, by id otherwise", () => {
    expect(
      resolveProviderRefForCapability(
        "selectionTranslation",
        providersConfig,
        "read-frog-ai:gpt-6.2-sol",
        MODELS,
      ),
    ).toEqual({
      kind: "system",
      id: "read-frog-ai:gpt-6.2-sol",
      name: "GPT-6.2 Sol",
      model: "gpt-6.2-sol",
    })
    expect(
      resolveProviderRefForCapability("selectionTranslation", providersConfig, LUNA_PROVIDER_ID),
    ).toMatchObject({ name: "gpt-6-luna", model: "gpt-6-luna" })
  })

  it("puts the models in every menu that can run Built-in AI", () => {
    const options = getSelectableProvidersForCapability("pageTranslation", providersConfig, MODELS)

    expect(options.filter((option) => "kind" in option)).toHaveLength(5)
  })
})
