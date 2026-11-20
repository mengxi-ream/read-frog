import { beforeEach, describe, expect, it } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import {
  getEffectiveHostedAiReasoning,
  getHostedAiModelName,
  getHostedAiModelsFromStatus,
  getRequestedHostedAiReasoning,
  readHostedAiReasoningChoice,
  readStoredHostedAiModels,
  sanitizeHostedAiModels,
  storeHostedAiModels,
} from "../models"
import { testHostedAiModels } from "./test-models"

const [haiku, luna, , sol] = sanitizeHostedAiModels(testHostedAiModels())!

describe("sanitizeHostedAiModels", () => {
  it("keeps the server's order and every field of a well-formed model", () => {
    expect(sanitizeHostedAiModels(testHostedAiModels())?.map((model) => model.id)).toEqual([
      "claude-haiku-5-5",
      "gpt-6-luna",
      "deepseek-v4.1-flash",
      "gpt-6.2-sol",
      "claude-sonnet-5-5",
    ])
    expect(sol).toEqual({
      id: "gpt-6.2-sol",
      name: "GPT-6.2 Sol",
      vendor: "openai",
      tier: "advance",
      modelRevision: "gpt-6.2-sol-r1",
      reasoning: { levels: ["low", "medium", "high", "xhigh"], default: "low" },
      available: true,
    })
  })

  it("is null without a list, which is not the same as an empty one", () => {
    expect(sanitizeHostedAiModels(undefined)).toBeNull()
    expect(sanitizeHostedAiModels({})).toBeNull()
    expect(sanitizeHostedAiModels([])).toEqual([])
    expect(getHostedAiModelsFromStatus({ pools: [] } as never)).toBeNull()
  })

  it("drops malformed entries one by one instead of the whole list", () => {
    // Each dropped entry is well formed but for the one field it is named after.
    const model = { vendor: "openai", tier: "normal", modelRevision: "r", available: true }
    const models = sanitizeHostedAiModels([
      null,
      { ...model, id: "", name: "Empty" },
      { ...model, id: "x".repeat(65), name: "Long" },
      { ...model, id: "pro-model", name: "Pro", tier: "pro" },
      { ...model, id: "no-revision", name: "No revision", modelRevision: undefined },
      { ...model, id: "no-vendor", name: "No vendor", vendor: undefined },
      {
        id: "gpt-6-luna",
        name: "GPT-6 Luna",
        vendor: "openai",
        tier: "normal",
        modelRevision: "r1",
      },
      { ...model, id: "gpt-6-luna", name: "Duplicate", modelRevision: "r2" },
    ])

    expect(models).toEqual([
      {
        id: "gpt-6-luna",
        name: "GPT-6 Luna",
        vendor: "openai",
        tier: "normal",
        modelRevision: "r1",
        reasoning: { levels: [], default: null },
        // A response without the flag says nothing against the model.
        available: true,
      },
    ])
  })

  it("keeps only the reasoning levels this client can ask for", () => {
    const [model] = sanitizeHostedAiModels([
      {
        id: "future-model",
        name: "Future",
        vendor: "openai",
        tier: "normal",
        modelRevision: "r1",
        reasoning: { levels: ["low", "max", "high"], default: "max" },
        available: true,
      },
    ])!

    expect(model!.reasoning).toEqual({ levels: ["low", "high"], default: null })
  })

  it("keeps a model only when it names its vendor with a non-empty string", () => {
    const models = sanitizeHostedAiModels(
      [" openai ", "", "   ", 42, null, { id: "openai" }, undefined].map((vendor, index) => ({
        id: `model-${index}`,
        name: "Model",
        vendor,
        tier: "normal",
        modelRevision: "r1",
      })),
    )

    // Trimmed, as the contract's schema has the server send it.
    expect(models?.map(({ id, vendor }) => ({ id, vendor }))).toEqual([
      { id: "model-0", vendor: "openai" },
    ])
  })

  it("names a model by its id when the list does not have it", () => {
    expect(getHostedAiModelName([luna!], "gpt-6-luna")).toBe("GPT-6 Luna")
    expect(getHostedAiModelName([luna!], "gpt-5-mini")).toBe("gpt-5-mini")
    expect(getHostedAiModelName(null, "gpt-6-luna")).toBe("gpt-6-luna")
  })
})

describe("reasoning levels", () => {
  it("shows the user's choice when the model takes it, and the model's default otherwise", () => {
    expect(getEffectiveHostedAiReasoning(sol!, "high")).toBe("high")
    expect(getEffectiveHostedAiReasoning(sol!, "none")).toBe("low")
    expect(getEffectiveHostedAiReasoning(sol!, undefined)).toBe("low")
    expect(getEffectiveHostedAiReasoning(sol!, "bogus")).toBe("low")
    expect(getEffectiveHostedAiReasoning(haiku!, undefined)).toBe("none")
  })

  it("asks for the level the control shows", () => {
    const options = { languageDetection: false }
    expect(getRequestedHostedAiReasoning(sol, "xhigh", options)).toBe("xhigh")
    expect(getRequestedHostedAiReasoning(sol, undefined, options)).toBe("low")
    expect(getRequestedHostedAiReasoning(haiku, "xhigh", options)).toBe("none")
  })

  it("never asks for a level for language detection", () => {
    expect(getRequestedHostedAiReasoning(sol, "high", { languageDetection: true })).toBeUndefined()
    expect(
      getRequestedHostedAiReasoning(undefined, "high", { languageDetection: true }),
    ).toBeUndefined()
  })

  it("sends the choice as it is for a model the list does not know, and nothing without one", () => {
    const options = { languageDetection: false }
    expect(getRequestedHostedAiReasoning(undefined, "medium", options)).toBe("medium")
    expect(getRequestedHostedAiReasoning(undefined, undefined, options)).toBeUndefined()
    expect(getRequestedHostedAiReasoning(undefined, "max", options)).toBeUndefined()
  })
})

describe("stored model list and reasoning choice", () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it("keeps the last list across reads, and skips writing one that did not change", async () => {
    expect(await readStoredHostedAiModels()).toBeNull()

    await storeHostedAiModels([luna!, sol!])
    expect(await readStoredHostedAiModels()).toEqual([luna, sol])

    const before = await fakeBrowser.storage.local.get("hostedAiModels")
    await storeHostedAiModels([luna!, sol!])
    const after = await fakeBrowser.storage.local.get("hostedAiModels")
    expect(after).toEqual(before)
  })

  it("reads the level picked for a model straight from the stored config", async () => {
    await fakeBrowser.storage.local.set({
      config: {
        builtInAi: {
          models: { "gpt-6.2-sol": { reasoning: "high" }, "gpt-6-luna": { reasoning: "max" } },
        },
      },
    })

    expect(await readHostedAiReasoningChoice("gpt-6.2-sol")).toBe("high")
    // A level this client does not know never reaches a request.
    expect(await readHostedAiReasoningChoice("gpt-6-luna")).toBeUndefined()
    expect(await readHostedAiReasoningChoice("claude-haiku-5-5")).toBeUndefined()
  })

  it("reads no level from a config stored before models could be chosen", async () => {
    await fakeBrowser.storage.local.set({ config: { pageTranslation: {} } })

    expect(await readHostedAiReasoningChoice("gpt-6-luna")).toBeUndefined()
  })
})
