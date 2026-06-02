// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { createStore } from "jotai"
import { beforeEach, describe, expect, it } from "vitest"
import { fakeBrowser } from "wxt/testing"
import { configAtom } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig, getTranslateProvidersConfig } from "@/utils/config/helpers"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { selectedProviderIdsAtom } from "../atoms"

function enabledTranslateProviderIds(config: Config): string[] {
  return filterEnabledProvidersConfig(getTranslateProvidersConfig(config.providersConfig)).map(p => p.id)
}

describe("selectedProviderIdsAtom", () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it("defaults to all enabled translate providers when nothing is persisted", () => {
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)

    const expected = enabledTranslateProviderIds(DEFAULT_CONFIG)
    expect(expected.length).toBeGreaterThan(0)
    expect(store.get(selectedProviderIdsAtom)).toEqual(expected)
  })

  it("persists the chosen selection to config and reads it back", async () => {
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)

    const [firstId] = enabledTranslateProviderIds(DEFAULT_CONFIG)
    await store.set(selectedProviderIdsAtom, [firstId])

    expect(store.get(configAtom).translationHub.selectedProviderIds).toEqual([firstId])
    expect(store.get(selectedProviderIdsAtom)).toEqual([firstId])
  })

  it("drops persisted ids whose providers were removed or disabled", () => {
    const store = createStore()
    const [keptId] = enabledTranslateProviderIds(DEFAULT_CONFIG)

    // Disable one currently-enabled translate provider so it should be filtered out.
    const disabledId = enabledTranslateProviderIds(DEFAULT_CONFIG).find(id => id !== keptId)!
    const providersConfig = DEFAULT_CONFIG.providersConfig.map(p =>
      p.id === disabledId ? { ...p, enabled: false } : p,
    )

    store.set(configAtom, {
      ...DEFAULT_CONFIG,
      providersConfig,
      translationHub: { selectedProviderIds: [keptId, disabledId, "ghost-provider"] },
    })

    expect(store.get(selectedProviderIdsAtom)).toEqual([keptId])
  })
})
