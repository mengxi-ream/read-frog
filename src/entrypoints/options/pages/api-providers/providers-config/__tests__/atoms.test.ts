// @vitest-environment jsdom
import { createStore } from "jotai"
import { describe, expect, it } from "vitest"
import { DEFAULT_BUILT_IN_AI_PROVIDER_ID } from "@/utils/providers/provider-registry"
import { selectedProviderIdAtom } from "../atoms"

describe("selectedProviderIdAtom", () => {
  it("opens on the normal Built-in AI provider", () => {
    const store = createStore()

    expect(store.get(selectedProviderIdAtom)).toBe(DEFAULT_BUILT_IN_AI_PROVIDER_ID)
  })

  it("keeps the provider picked afterwards", async () => {
    const store = createStore()

    await store.set(selectedProviderIdAtom, "provider-1")

    expect(store.get(selectedProviderIdAtom)).toBe("provider-1")
  })
})
