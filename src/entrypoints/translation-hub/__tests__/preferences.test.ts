// @vitest-environment jsdom
// oxlint-disable typescript/unbound-method -- Storage methods are arrow-function mocks.

import type { Config } from "@/types/config/config"
import { createStore } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  exchangeLangCodesAtom,
  selectedProviderIdsAtom,
  sourceLangCodeAtom,
  targetLangCodeAtom,
} from "../atoms"

const persisted = vi.hoisted(() => ({ value: {} as Config }))

vi.mock("@/utils/atoms/storage-adapter", () => ({
  storageAdapter: {
    get: vi.fn<() => Promise<Config>>(async () => structuredClone(persisted.value)),
    set: vi.fn<(key: string, config: Config) => Promise<void>>(async (_key, config) => {
      persisted.value = structuredClone(config)
    }),
    setMeta: vi.fn<() => Promise<void>>(async () => {}),
    watch: () => () => {},
  },
}))

function openHub() {
  const store = createStore()
  store.set(configAtom, structuredClone(persisted.value))
  return store
}

describe("Translation Hub preferences", () => {
  beforeEach(() => {
    persisted.value = structuredClone(DEFAULT_CONFIG)
    vi.mocked(storageAdapter.set).mockClear()
  })

  it("restores provider and language choices after reopening", async () => {
    const first = openHub()
    const providerId = first.get(selectedProviderIdsAtom)[0]!

    await first.set(selectedProviderIdsAtom, [providerId])
    await first.set(sourceLangCodeAtom, "spa")
    await first.set(targetLangCodeAtom, "eng")

    const reopened = openHub()
    expect(reopened.get(selectedProviderIdsAtom)).toEqual([providerId])
    expect(reopened.get(sourceLangCodeAtom)).toBe("spa")
    expect(reopened.get(targetLangCodeAtom)).toBe("eng")
    expect(persisted.value.language).toEqual(DEFAULT_CONFIG.language)
  })

  it("keeps an explicitly empty selection and filters unavailable providers", async () => {
    const first = openHub()
    await first.set(selectedProviderIdsAtom, [])
    expect(openHub().get(selectedProviderIdsAtom)).toEqual([])

    await first.set(selectedProviderIdsAtom, ["removed-provider", "read-frog-free-ai"])
    expect(openHub().get(selectedProviderIdsAtom)).toEqual(["read-frog-free-ai"])

    const localId = DEFAULT_CONFIG.providersConfig.find(
      (provider) => provider.enabled && provider.provider === "microsoft-translate",
    )?.id
    expect(localId).toBeDefined()
    await first.set(selectedProviderIdsAtom, [localId!])
    persisted.value.providersConfig = persisted.value.providersConfig.map((provider) =>
      provider.id === localId ? { ...provider, enabled: false } : provider,
    )
    expect(openHub().get(selectedProviderIdsAtom)).toEqual([])
  })

  it("writes an auto-source language swap as one preference update", async () => {
    const store = openHub()
    store.set(configAtom, {
      ...store.get(configAtom),
      language: { ...DEFAULT_CONFIG.language, sourceCode: "auto", targetCode: "spa" },
    })
    store.set(exchangeLangCodesAtom)

    expect(store.get(sourceLangCodeAtom)).toBe("spa")
    expect(store.get(targetLangCodeAtom)).toBe("eng")
    await vi.waitFor(() => expect(storageAdapter.set).toHaveBeenCalledTimes(1))
    expect(persisted.value.translationHub).toMatchObject({
      sourceCode: "spa",
      targetCode: "eng",
    })
  })
})
