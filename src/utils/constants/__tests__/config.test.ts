import { afterEach, describe, expect, it, vi } from "vitest"

describe("dEFAULT_CONFIG", () => {
  const originalCrypto = globalThis.crypto

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    })
    vi.resetModules()
  })

  it("initializes when crypto.randomUUID is unavailable but crypto.getRandomValues exists", async () => {
    const getRandomValues = vi.fn((array: Uint8Array<ArrayBuffer>) => originalCrypto.getRandomValues(array))

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues,
      } as unknown as Crypto,
    })
    vi.resetModules()

    const { DEFAULT_CONFIG } = await import("../config")
    const defaultDictionaryAction = DEFAULT_CONFIG.selectionToolbar.customActions[0]

    expect(defaultDictionaryAction).toEqual(expect.objectContaining({
      id: "default-dictionary",
    }))
    expect(defaultDictionaryAction?.outputSchema).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "default-dictionary-term" }),
    ]))
    expect(defaultDictionaryAction?.outputSchema.every(field => typeof field.id === "string" && field.id.length > 0)).toBe(true)
    expect(getRandomValues).toHaveBeenCalled()
  })
})
