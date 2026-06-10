import type { APIProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearAPIKeyRotationStateForTests,
  getNextProviderAPIKey,
  parseProviderAPIKeys,
  withProviderAPIKeyRotation,
} from "../api-key-rotation"

function provider(overrides: Partial<APIProviderConfig> = {}): APIProviderConfig {
  return {
    id: "provider-1",
    name: "Provider",
    enabled: true,
    provider: "deepl",
    apiKey: "key-a,key-b,key-c",
    ...overrides,
  } as APIProviderConfig
}

describe("api key rotation", () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    clearAPIKeyRotationStateForTests()
  })

  it("parses comma-separated keys, trims blanks, and removes duplicates", () => {
    expect(parseProviderAPIKeys(" key-a, key-b ,, key-a ,key-c ")).toEqual([
      "key-a",
      "key-b",
      "key-c",
    ])
  })

  it("rotates sequentially across configured keys", () => {
    const config = provider()

    expect(getNextProviderAPIKey(config)).toBe("key-a")
    expect(getNextProviderAPIKey(config)).toBe("key-b")
    expect(getNextProviderAPIKey(config)).toBe("key-c")
    expect(getNextProviderAPIKey(config)).toBe("key-a")
  })

  it("can select a key randomly", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9)

    expect(getNextProviderAPIKey(provider({ apiKeyRotationMode: "random" }))).toBe("key-c")
  })

  it("cools down a failed key and immediately falls back to the next key", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    const config = provider({ apiKey: "bad-key,good-key", apiKeyCooldownSeconds: 60 })
    const attempts: string[] = []

    const result = await withProviderAPIKeyRotation(config, async (apiKey) => {
      attempts.push(apiKey ?? "")
      if (apiKey === "bad-key")
        throw new Error("bad key")
      return "translated"
    })

    expect(result).toBe("translated")
    expect(attempts).toEqual(["bad-key", "good-key"])

    expect(getNextProviderAPIKey(config)).toBe("good-key")

    vi.setSystemTime(61_000)
    expect(getNextProviderAPIKey(config)).toBe("bad-key")
  })

  it("reports when every key is cooling down", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    const config = provider({ apiKey: "key-a,key-b", apiKeyCooldownSeconds: 60 })
    await expect(withProviderAPIKeyRotation(config, async () => {
      throw new Error("failed")
    })).rejects.toThrow("All configured API keys failed")

    expect(() => getNextProviderAPIKey(config)).toThrow("cooling down")
  })
})
