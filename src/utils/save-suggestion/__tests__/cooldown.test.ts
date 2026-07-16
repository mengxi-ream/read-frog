import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import {
  getRejectionCooldownMs,
  getSaveSuggestionCooldownState,
  isSaveSuggestionEligible,
  recordSaveSuggestionAccepted,
  recordSaveSuggestionShown,
  SAVE_SUGGESTION_ACCEPT_COOLDOWN_MS,
  SAVE_SUGGESTION_BASE_REJECT_COOLDOWN_MS,
  SAVE_SUGGESTION_COOLDOWN_STORAGE_KEY,
  SAVE_SUGGESTION_MAX_REJECT_COOLDOWN_MS,
} from "../cooldown"

const STORAGE_KEY = `local:${SAVE_SUGGESTION_COOLDOWN_STORAGE_KEY}`
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

describe("save suggestion cooldown", () => {
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
  })

  describe("getRejectionCooldownMs", () => {
    it("doubles from 24h and caps at 32 days", () => {
      expect(getRejectionCooldownMs(0)).toBe(24 * HOUR_MS)
      expect(getRejectionCooldownMs(1)).toBe(48 * HOUR_MS)
      expect(getRejectionCooldownMs(2)).toBe(96 * HOUR_MS)
      expect(getRejectionCooldownMs(3)).toBe(8 * DAY_MS)
      expect(getRejectionCooldownMs(4)).toBe(16 * DAY_MS)
      expect(getRejectionCooldownMs(5)).toBe(32 * DAY_MS)
      expect(getRejectionCooldownMs(6)).toBe(SAVE_SUGGESTION_MAX_REJECT_COOLDOWN_MS)
      expect(getRejectionCooldownMs(9)).toBe(SAVE_SUGGESTION_MAX_REJECT_COOLDOWN_MS)
    })

    it("treats negative counts as zero", () => {
      expect(getRejectionCooldownMs(-1)).toBe(SAVE_SUGGESTION_BASE_REJECT_COOLDOWN_MS)
    })
  })

  describe("eligibility", () => {
    it("is eligible with no stored state", async () => {
      await expect(isSaveSuggestionEligible()).resolves.toBe(true)
    })

    it("is ineligible while cooling down and eligible after it expires", async () => {
      const now = 1_000_000
      storageValues.set(STORAGE_KEY, { consecutiveRejections: 1, cooldownUntil: now + 1 })
      await expect(isSaveSuggestionEligible(now)).resolves.toBe(false)
      await expect(isSaveSuggestionEligible(now + 1)).resolves.toBe(true)
    })

    it("treats corrupt stored values as no state", async () => {
      storageValues.set(STORAGE_KEY, { consecutiveRejections: "many" })
      await expect(getSaveSuggestionCooldownState()).resolves.toBeNull()
      await expect(isSaveSuggestionEligible()).resolves.toBe(true)
    })
  })

  describe("recordSaveSuggestionShown", () => {
    it("writes the first pessimistic rejection with a 24h cooldown", async () => {
      const now = 5_000
      await recordSaveSuggestionShown(now)
      expect(storageValues.get(STORAGE_KEY)).toEqual({
        consecutiveRejections: 1,
        cooldownUntil: now + 24 * HOUR_MS,
      })
    })

    it("stacks onto prior rejections with exponential backoff", async () => {
      const now = 5_000
      storageValues.set(STORAGE_KEY, { consecutiveRejections: 2, cooldownUntil: 0 })
      await recordSaveSuggestionShown(now)
      expect(storageValues.get(STORAGE_KEY)).toEqual({
        consecutiveRejections: 3,
        cooldownUntil: now + 96 * HOUR_MS,
      })
    })
  })

  describe("recordSaveSuggestionAccepted", () => {
    it("resets rejections and applies the 12h accept cooldown", async () => {
      const now = 9_000
      storageValues.set(STORAGE_KEY, { consecutiveRejections: 4, cooldownUntil: 0 })
      await recordSaveSuggestionAccepted(now)
      expect(storageValues.get(STORAGE_KEY)).toEqual({
        consecutiveRejections: 0,
        cooldownUntil: now + SAVE_SUGGESTION_ACCEPT_COOLDOWN_MS,
      })
    })

    it("next rejection after acceptance restarts at 24h", async () => {
      const now = 9_000
      await recordSaveSuggestionAccepted(now)
      await recordSaveSuggestionShown(now + 1)
      expect(storageValues.get(STORAGE_KEY)).toEqual({
        consecutiveRejections: 1,
        cooldownUntil: now + 1 + 24 * HOUR_MS,
      })
    })
  })
})
