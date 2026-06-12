import type { Config } from "@/types/config/config"
import { createStore } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { getTranslateProvidersConfig } from "@/utils/config/helpers"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { exchangeLangCodesAtom, selectedProviderIdsAtom, sourceLangCodeAtom, targetLangCodeAtom } from "./atoms"

const storageState = vi.hoisted(() => ({
  value: undefined as Config | undefined,
}))

const storageAdapterMock = vi.hoisted(() => ({
  get: vi.fn(async (_key: string, fallback: Config) => structuredClone(storageState.value ?? fallback)),
  set: vi.fn(async (_key: string, value: Config) => {
    storageState.value = structuredClone(value)
  }),
  setMeta: vi.fn(async () => {}),
  watch: vi.fn(() => () => {}),
}))

vi.mock("@/utils/atoms/storage-adapter", () => ({
  storageAdapter: storageAdapterMock,
}))

const DEFAULT_MICROSOFT_PROVIDER_ID = "microsoft-translate-default"

function createTestConfig(): Config {
  return structuredClone(DEFAULT_CONFIG)
}

describe("translation hub atoms", () => {
  beforeEach(() => {
    storageState.value = createTestConfig()
    storageAdapterMock.get.mockImplementation(async (_key: string, fallback: Config) => structuredClone(storageState.value ?? fallback))
    storageAdapterMock.set.mockImplementation(async (_key: string, value: Config) => {
      storageState.value = structuredClone(value)
    })
    storageAdapterMock.set.mockClear()
    storageAdapterMock.setMeta.mockClear()
    storageAdapterMock.watch.mockClear()
  })

  it("selects only Microsoft by default when it is enabled", () => {
    const store = createStore()
    store.set(configAtom, createTestConfig())

    expect(store.get(selectedProviderIdsAtom)).toEqual([DEFAULT_MICROSOFT_PROVIDER_ID])
  })

  it("falls back to the configured translate provider when Microsoft is disabled", () => {
    const store = createStore()
    const config = createTestConfig()
    const fallbackProvider = getTranslateProvidersConfig(config.providersConfig)
      .find(provider => provider.enabled && provider.id !== DEFAULT_MICROSOFT_PROVIDER_ID)

    if (!fallbackProvider)
      throw new Error("Expected an enabled non-Microsoft translate provider in DEFAULT_CONFIG")

    store.set(configAtom, {
      ...config,
      providersConfig: config.providersConfig.map(provider =>
        provider.id === DEFAULT_MICROSOFT_PROVIDER_ID
          ? { ...provider, enabled: false }
          : provider,
      ),
      translate: {
        ...config.translate,
        providerId: fallbackProvider.id,
      },
    })

    expect(store.get(selectedProviderIdsAtom)).toEqual([fallbackProvider.id])
  })

  it("uses configured translation hub provider ids when they are enabled", () => {
    const store = createStore()
    const config = createTestConfig()
    const configuredProviderIds = getTranslateProvidersConfig(config.providersConfig)
      .filter(provider => provider.enabled)
      .slice(0, 2)
      .map(provider => provider.id)

    store.set(configAtom, {
      ...config,
      translate: {
        ...config.translate,
        translationHub: {
          selectedProviderIds: configuredProviderIds,
        },
      },
    })

    expect(store.get(selectedProviderIdsAtom)).toEqual(configuredProviderIds)
  })

  it("preserves an explicit empty translation hub provider selection", () => {
    const store = createStore()
    const config = createTestConfig()

    store.set(configAtom, {
      ...config,
      translate: {
        ...config.translate,
        translationHub: {
          selectedProviderIds: [],
        },
      },
    })

    expect(store.get(selectedProviderIdsAtom)).toEqual([])
  })

  it("persists source and target language selections to translation hub config", async () => {
    const store = createStore()
    const config = createTestConfig()
    store.set(configAtom, {
      ...config,
      language: {
        ...config.language,
        sourceCode: "auto",
        targetCode: "jpn",
      },
    })
    storageState.value = structuredClone(store.get(configAtom))

    await store.set(sourceLangCodeAtom, "cmn")
    await store.set(targetLangCodeAtom, "eng")

    expect(store.get(configAtom).translate.translationHub).toMatchObject({
      sourceCode: "cmn",
      targetCode: "eng",
    })
    expect(store.get(configAtom).language).toMatchObject({
      sourceCode: "auto",
      targetCode: "jpn",
    })
    expect(storageAdapterMock.set).toHaveBeenCalled()
  })

  it("persists exchanged languages to translation hub config", async () => {
    const store = createStore()
    const config = createTestConfig()
    store.set(configAtom, {
      ...config,
      translate: {
        ...config.translate,
        translationHub: {
          ...config.translate.translationHub,
          sourceCode: "cmn",
          targetCode: "eng",
        },
      },
    })

    await store.set(exchangeLangCodesAtom)

    expect(store.get(configAtom).translate.translationHub).toMatchObject({
      sourceCode: "eng",
      targetCode: "cmn",
    })
    expect(store.get(configAtom).language).toEqual(config.language)
  })
})
