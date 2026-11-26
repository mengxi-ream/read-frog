import type { ProviderConfig } from "@/types/config/provider"
import type { SystemProviderSelectorItem } from "@/utils/providers/provider-display"
import { describe, expect, it } from "vitest"
import { testHostedAiModels } from "@/utils/hosted-ai/__tests__/test-models"
import { sanitizeHostedAiModels } from "@/utils/hosted-ai/models"
import {
  getBuiltInAiAlternativeNames,
  getBuiltInAiUnavailability,
} from "@/utils/providers/provider-display"
import { getBuiltInAiSelectorItems } from "@/utils/providers/provider-registry"

const OWN_DEEPL = {
  id: "deepl-default",
  name: "DeepL",
  enabled: true,
  provider: "deepl",
} as ProviderConfig

function getItems(
  overrides: Parameters<typeof testHostedAiModels>[0] = {},
  selected: string[] = [],
): SystemProviderSelectorItem[] {
  return getBuiltInAiSelectorItems(sanitizeHostedAiModels(testHostedAiModels(overrides)), selected)
}

function getItem(items: SystemProviderSelectorItem[], modelId: string) {
  const item = items.find((candidate) => candidate.model === modelId)
  if (!item) {
    throw new Error(`No item for ${modelId}`)
  }
  return item
}

describe("getBuiltInAiUnavailability", () => {
  it("is null for a listed model that can run", () => {
    expect(getBuiltInAiUnavailability(getItem(getItems(), "gpt-6-luna"))).toBeNull()
  })

  it("is temporary for a listed model the server says cannot run now", () => {
    const items = getItems({ "gpt-6-luna": { available: false } })

    expect(getBuiltInAiUnavailability(getItem(items, "gpt-6-luna"))).toBe("temporary")
  })

  it("is removed for a selected model the list no longer names", () => {
    const items = getItems({}, ["read-frog-ai:gpt-5-mini"])

    expect(getBuiltInAiUnavailability(getItem(items, "gpt-5-mini"))).toBe("removed")
  })

  it("is null while no list is known, so nothing is called unavailable on a guess", () => {
    const items = getBuiltInAiSelectorItems(null, ["read-frog-ai:gpt-5-mini"])

    expect(getBuiltInAiUnavailability(getItem(items, "gpt-5-mini"))).toBeNull()
  })

  it("is null for the user's own providers", () => {
    expect(getBuiltInAiUnavailability(OWN_DEEPL)).toBeNull()
  })
})

describe("getBuiltInAiAlternativeNames", () => {
  it("names the other models that can run, in the menu's order", () => {
    const items = getItems({ "gpt-6.2-sol": { available: false } })
    const sol = getItem(items, "gpt-6.2-sol")

    expect(getBuiltInAiAlternativeNames(sol, [...items, OWN_DEEPL])).toEqual([
      "Claude Haiku 5.5",
      "GPT-6 Luna",
      "DeepSeek V4.1 Flash",
      "Claude Sonnet 5.5",
    ])
  })

  it("leaves out models that cannot run and ones locked for this account", () => {
    const items = getItems({
      "gpt-6.2-sol": { available: false },
      "claude-haiku-5-5": { available: false },
    }).map((item) => (item.tier === "advance" ? { ...item, disabled: true } : item))
    const sol = getItem(items, "gpt-6.2-sol")

    expect(getBuiltInAiAlternativeNames(sol, items)).toEqual(["GPT-6 Luna", "DeepSeek V4.1 Flash"])
  })
})
