import type { Config } from "@/types/config/config"
import { createStore } from "jotai"
import { afterEach, describe, expect, it } from "vitest"
import { storage } from "#imports"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  exchangeLangCodesAtom,
  selectedProviderIdsAtom,
  sourceLangCodeAtom,
  targetLangCodeAtom,
} from "../atoms"

const CONFIG_KEY = "local:config"

function cloneConfig(): Config {
  return structuredClone(DEFAULT_CONFIG)
}

async function createSeededStore(config: Config) {
  await storage.setItem(CONFIG_KEY, config)
  const store = createStore()
  store.set(configAtom, config)
  return store
}

afterEach(async () => {
  await storage.removeItem(CONFIG_KEY)
})

describe("Translation Hub preferences", () => {
  it("persists the selected providers and restores them in a new store", async () => {
    const config = cloneConfig()
    const store = await createSeededStore(config)

    await store.set(selectedProviderIdsAtom, ["google-translate-default"])

    expect(store.get(selectedProviderIdsAtom)).toEqual(["google-translate-default"])
    expect((await storage.getItem<Config>(CONFIG_KEY))?.translationHub).toEqual({
      selectedProviderIds: ["google-translate-default"],
    })

    const restoredConfig = (await storage.getItem<Config>(CONFIG_KEY))!
    const restoredStore = createStore()
    restoredStore.set(configAtom, restoredConfig)
    expect(restoredStore.get(selectedProviderIdsAtom)).toEqual(["google-translate-default"])
  })

  it("preserves an explicit empty selection and ignores unavailable provider IDs", async () => {
    const config = cloneConfig()
    config.translationHub.selectedProviderIds = ["missing-provider"]
    const store = await createSeededStore(config)

    expect(store.get(selectedProviderIdsAtom)).toEqual([])

    await store.set(selectedProviderIdsAtom, [])
    expect((await storage.getItem<Config>(CONFIG_KEY))?.translationHub.selectedProviderIds).toEqual(
      [],
    )
  })

  it("persists language changes and exchanges both directions in one write", async () => {
    const store = await createSeededStore(cloneConfig())

    await store.set(sourceLangCodeAtom, "cmn")
    await store.set(targetLangCodeAtom, "eng")
    await store.set(exchangeLangCodesAtom)

    expect(store.get(sourceLangCodeAtom)).toBe("eng")
    expect(store.get(targetLangCodeAtom)).toBe("cmn")
    expect((await storage.getItem<Config>(CONFIG_KEY))?.language).toMatchObject({
      sourceCode: "eng",
      targetCode: "cmn",
    })
  })
})
