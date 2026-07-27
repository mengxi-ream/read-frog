import type { LLMProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import {
  getFailureCooldownMs,
  getSaveSuggestionProviderCooldownState,
  getSaveSuggestionProviderFingerprint,
  isSaveSuggestionAttemptAllowed,
  recordSaveSuggestionFailure,
  recordSaveSuggestionSuccess,
  SAVE_SUGGESTION_BASE_FAILURE_COOLDOWN_MS,
  SAVE_SUGGESTION_PROVIDER_COOLDOWN_STORAGE_KEY,
} from "../provider-cooldown"

const STORAGE_KEY = `local:${SAVE_SUGGESTION_PROVIDER_COOLDOWN_STORAGE_KEY}`
const MINUTE_MS = 60 * 1000

const KEY = { providerId: "provider-a", providerFingerprint: "fp-a" }
const OTHER_ID_KEY = { providerId: "provider-b", providerFingerprint: "fp-a" }
const OTHER_FINGERPRINT_KEY = { providerId: "provider-a", providerFingerprint: "fp-b" }

describe("save suggestion provider cooldown", () => {
  const storageValues = new Map<string, unknown>()

  beforeEach(() => {
    storageValues.clear()
    storage.getItem = vi.fn<(...args: any[]) => any>((key: string) =>
      Promise.resolve(storageValues.get(key) ?? null),
    )
    storage.setItem = vi.fn<(...args: any[]) => any>((key: string, value: unknown) => {
      storageValues.set(key, value)
      return Promise.resolve()
    })
    storage.removeItem = vi.fn<(...args: any[]) => any>((key: string) => {
      storageValues.delete(key)
      return Promise.resolve()
    })
  })

  describe("getFailureCooldownMs", () => {
    it("doubles from 2 minutes without a cap", () => {
      expect(getFailureCooldownMs(1)).toBe(2 * MINUTE_MS)
      expect(getFailureCooldownMs(2)).toBe(4 * MINUTE_MS)
      expect(getFailureCooldownMs(3)).toBe(8 * MINUTE_MS)
      expect(getFailureCooldownMs(6)).toBe(64 * MINUTE_MS)
      expect(getFailureCooldownMs(10)).toBe(1024 * MINUTE_MS)
    })

    it("treats zero and negative counts as the base cooldown", () => {
      expect(getFailureCooldownMs(0)).toBe(SAVE_SUGGESTION_BASE_FAILURE_COOLDOWN_MS)
      expect(getFailureCooldownMs(-3)).toBe(SAVE_SUGGESTION_BASE_FAILURE_COOLDOWN_MS)
    })
  })

  describe("isSaveSuggestionAttemptAllowed", () => {
    it("is allowed with no stored state", async () => {
      await expect(isSaveSuggestionAttemptAllowed(KEY)).resolves.toBe(true)
    })

    it("is blocked while cooling down and allowed once the cooldown expires", async () => {
      const now = 1_000_000
      storageValues.set(STORAGE_KEY, {
        ...KEY,
        consecutiveFailures: 1,
        cooldownUntil: now + 1,
      })
      await expect(isSaveSuggestionAttemptAllowed(KEY, now)).resolves.toBe(false)
      await expect(isSaveSuggestionAttemptAllowed(KEY, now + 1)).resolves.toBe(true)
    })

    it("is allowed immediately when the provider id differs", async () => {
      const now = 1_000_000
      storageValues.set(STORAGE_KEY, {
        ...KEY,
        consecutiveFailures: 5,
        cooldownUntil: now + MINUTE_MS,
      })
      await expect(isSaveSuggestionAttemptAllowed(OTHER_ID_KEY, now)).resolves.toBe(true)
    })

    it("is allowed immediately when the fingerprint differs for the same id", async () => {
      const now = 1_000_000
      storageValues.set(STORAGE_KEY, {
        ...KEY,
        consecutiveFailures: 5,
        cooldownUntil: now + MINUTE_MS,
      })
      await expect(isSaveSuggestionAttemptAllowed(OTHER_FINGERPRINT_KEY, now)).resolves.toBe(true)
    })

    it("treats corrupt stored values as no state", async () => {
      storageValues.set(STORAGE_KEY, { consecutiveFailures: "many" })
      await expect(getSaveSuggestionProviderCooldownState()).resolves.toBeNull()
      await expect(isSaveSuggestionAttemptAllowed(KEY)).resolves.toBe(true)
    })
  })

  describe("recordSaveSuggestionFailure", () => {
    it("writes the first failure with the base cooldown", async () => {
      const now = 5_000
      await recordSaveSuggestionFailure(KEY, now)
      expect(storageValues.get(STORAGE_KEY)).toEqual({
        ...KEY,
        consecutiveFailures: 1,
        cooldownUntil: now + 2 * MINUTE_MS,
      })
    })

    it("stacks onto prior failures of the same provider key", async () => {
      const now = 5_000
      storageValues.set(STORAGE_KEY, { ...KEY, consecutiveFailures: 2, cooldownUntil: 0 })
      await recordSaveSuggestionFailure(KEY, now)
      expect(storageValues.get(STORAGE_KEY)).toEqual({
        ...KEY,
        consecutiveFailures: 3,
        cooldownUntil: now + 8 * MINUTE_MS,
      })
    })

    it("restarts at the base cooldown when the provider id changed", async () => {
      const now = 5_000
      storageValues.set(STORAGE_KEY, { ...KEY, consecutiveFailures: 4, cooldownUntil: 0 })
      await recordSaveSuggestionFailure(OTHER_ID_KEY, now)
      expect(storageValues.get(STORAGE_KEY)).toEqual({
        ...OTHER_ID_KEY,
        consecutiveFailures: 1,
        cooldownUntil: now + 2 * MINUTE_MS,
      })
    })

    it("restarts at the base cooldown when the fingerprint changed", async () => {
      const now = 5_000
      storageValues.set(STORAGE_KEY, { ...KEY, consecutiveFailures: 4, cooldownUntil: 0 })
      await recordSaveSuggestionFailure(OTHER_FINGERPRINT_KEY, now)
      expect(storageValues.get(STORAGE_KEY)).toEqual({
        ...OTHER_FINGERPRINT_KEY,
        consecutiveFailures: 1,
        cooldownUntil: now + 2 * MINUTE_MS,
      })
    })
  })

  describe("recordSaveSuggestionSuccess", () => {
    it("removes the state so the next failure restarts at the base cooldown", async () => {
      const now = 9_000
      storageValues.set(STORAGE_KEY, { ...KEY, consecutiveFailures: 4, cooldownUntil: 0 })
      await recordSaveSuggestionSuccess()
      expect(storageValues.has(STORAGE_KEY)).toBe(false)

      await recordSaveSuggestionFailure(KEY, now)
      expect(storageValues.get(STORAGE_KEY)).toEqual({
        ...KEY,
        consecutiveFailures: 1,
        cooldownUntil: now + 2 * MINUTE_MS,
      })
    })
  })

  describe("getSaveSuggestionProviderFingerprint", () => {
    const baseConfig = {
      id: "id-1",
      name: "OpenAI",
      enabled: true,
      provider: "openai",
      apiKey: "sk-1",
      model: { model: "gpt-4.1-mini", isCustomModel: false, customModel: "" },
    } as unknown as LLMProviderConfig

    it("is stable for an identical config object", () => {
      const clone = structuredClone(baseConfig)
      expect(getSaveSuggestionProviderFingerprint(clone)).toBe(
        getSaveSuggestionProviderFingerprint(baseConfig),
      )
    })

    it("changes when the api key or model changes", () => {
      const original = getSaveSuggestionProviderFingerprint(baseConfig)
      const rotatedKey = { ...baseConfig, apiKey: "sk-2" } as LLMProviderConfig
      const swappedModel = {
        ...baseConfig,
        model: { model: "gpt-4.1", isCustomModel: false, customModel: "" },
      } as LLMProviderConfig
      expect(getSaveSuggestionProviderFingerprint(rotatedKey)).not.toBe(original)
      expect(getSaveSuggestionProviderFingerprint(swappedModel)).not.toBe(original)
    })

    it("never embeds credential material (the persisted value is a hash)", () => {
      const fingerprint = getSaveSuggestionProviderFingerprint(baseConfig)
      expect(fingerprint).not.toContain("sk-1")
      expect(fingerprint).not.toContain("apiKey")
      expect(fingerprint).toMatch(/^[0-9a-f]{16}$/)
    })
  })
})
