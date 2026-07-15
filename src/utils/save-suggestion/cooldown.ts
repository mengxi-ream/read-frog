import { z } from "zod"
import { storage } from "#imports"

export const SAVE_SUGGESTION_COOLDOWN_STORAGE_KEY = "saveSuggestionCooldown"
export const SAVE_SUGGESTION_ACCEPT_COOLDOWN_MS = 12 * 60 * 60 * 1000
export const SAVE_SUGGESTION_BASE_REJECT_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const SAVE_SUGGESTION_MAX_REJECT_COOLDOWN_MS = 32 * 24 * 60 * 60 * 1000

export const saveSuggestionCooldownStateSchema = z.object({
  consecutiveRejections: z.number().int().min(0),
  cooldownUntil: z.number(),
})

export type SaveSuggestionCooldownState = z.infer<typeof saveSuggestionCooldownStateSchema>

function getStorageKey(): `local:${string}` {
  return `local:${SAVE_SUGGESTION_COOLDOWN_STORAGE_KEY}`
}

export function getRejectionCooldownMs(consecutiveRejectionsBefore: number): number {
  const exponent = Math.max(0, consecutiveRejectionsBefore)
  return Math.min(
    SAVE_SUGGESTION_BASE_REJECT_COOLDOWN_MS * 2 ** exponent,
    SAVE_SUGGESTION_MAX_REJECT_COOLDOWN_MS,
  )
}

export async function getSaveSuggestionCooldownState(): Promise<SaveSuggestionCooldownState | null> {
  const value = await storage.getItem<unknown>(getStorageKey())
  const parsed = saveSuggestionCooldownStateSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export async function isSaveSuggestionEligible(now = Date.now()): Promise<boolean> {
  const state = await getSaveSuggestionCooldownState()
  return state === null || now >= state.cooldownUntil
}

/**
 * Pessimistic write at card-show time: the rejection (and its exponential
 * backoff) is recorded the moment the card renders, so closing the popover or
 * killing the tab without saving is already counted correctly. A successful
 * save rewrites the state via `recordSaveSuggestionAccepted`.
 */
export async function recordSaveSuggestionShown(now = Date.now()): Promise<void> {
  const state = await getSaveSuggestionCooldownState()
  const rejectionsBefore = state?.consecutiveRejections ?? 0

  await storage.setItem(getStorageKey(), {
    consecutiveRejections: rejectionsBefore + 1,
    cooldownUntil: now + getRejectionCooldownMs(rejectionsBefore),
  } satisfies SaveSuggestionCooldownState)
}

export async function recordSaveSuggestionAccepted(now = Date.now()): Promise<void> {
  await storage.setItem(getStorageKey(), {
    consecutiveRejections: 0,
    cooldownUntil: now + SAVE_SUGGESTION_ACCEPT_COOLDOWN_MS,
  } satisfies SaveSuggestionCooldownState)
}
