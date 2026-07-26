import type { LLMProviderConfig } from "@/types/config/provider"
import { z } from "zod"
import { storage } from "#imports"

export const SAVE_SUGGESTION_PROVIDER_COOLDOWN_STORAGE_KEY = "saveSuggestionProviderCooldown"
export const SAVE_SUGGESTION_BASE_FAILURE_COOLDOWN_MS = 2 * 60 * 1000

export const saveSuggestionProviderCooldownStateSchema = z.object({
  providerId: z.string(),
  providerFingerprint: z.string(),
  consecutiveFailures: z.number().int().min(1),
  cooldownUntil: z.number(),
})

export type SaveSuggestionProviderCooldownState = z.infer<
  typeof saveSuggestionProviderCooldownStateSchema
>

export interface SaveSuggestionProviderKey {
  providerId: string
  providerFingerprint: string
}

/**
 * cyrb53-style 53-bit string hash. Collisions are astronomically unlikely and
 * only risk a benignly missed (or extra) cooldown reset.
 */
function hashString(input: string): string {
  let h1 = 0xde_ad_be_ef
  let h2 = 0x41_c6_ce_57
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2_654_435_761)
    h2 = Math.imul(h2 ^ ch, 1_597_334_677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2_246_822_507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3_266_489_909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2_246_822_507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3_266_489_909)
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0")
}

/**
 * Stable identity of the provider settings used for a suggestion attempt. Any
 * config change (apiKey, model, baseURL, ...) yields a new fingerprint, which
 * implicitly resets the failure state. The serialized config is hashed so no
 * credential material is persisted into the cooldown storage entry. Key order
 * comes from the storage-backed config object, so it is stable in practice; a
 * spurious mismatch only causes a benign reset.
 */
export function getSaveSuggestionProviderFingerprint(providerConfig: LLMProviderConfig): string {
  return hashString(JSON.stringify(providerConfig))
}

function getStorageKey(): `local:${string}` {
  return `local:${SAVE_SUGGESTION_PROVIDER_COOLDOWN_STORAGE_KEY}`
}

/** 1st failure → 2 min, then doubling without cap (a persistently failing provider ends up soft-locked). */
export function getFailureCooldownMs(consecutiveFailures: number): number {
  const exponent = Math.max(0, consecutiveFailures - 1)
  return SAVE_SUGGESTION_BASE_FAILURE_COOLDOWN_MS * 2 ** exponent
}

export async function getSaveSuggestionProviderCooldownState(): Promise<SaveSuggestionProviderCooldownState | null> {
  const value = await storage.getItem<unknown>(getStorageKey())
  const parsed = saveSuggestionProviderCooldownStateSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Read-only eligibility check: allowed when there is no state, the stored
 * state belongs to a different provider id or fingerprint (stale ⇒ implicit
 * reset), or the cooldown has expired.
 */
export async function isSaveSuggestionAttemptAllowed(
  key: SaveSuggestionProviderKey,
  now = Date.now(),
): Promise<boolean> {
  const state = await getSaveSuggestionProviderCooldownState()
  if (!state) {
    return true
  }
  if (
    state.providerId !== key.providerId ||
    state.providerFingerprint !== key.providerFingerprint
  ) {
    return true
  }
  return now >= state.cooldownUntil
}

/**
 * Concurrent tabs may race the read-modify-write; worst case one increment is
 * lost or an attempt runs one base-cooldown early. Accepted — no locking.
 */
export async function recordSaveSuggestionFailure(
  key: SaveSuggestionProviderKey,
  now = Date.now(),
): Promise<void> {
  const state = await getSaveSuggestionProviderCooldownState()
  const matchesKey =
    state !== null &&
    state.providerId === key.providerId &&
    state.providerFingerprint === key.providerFingerprint
  const consecutiveFailures = (matchesKey ? state.consecutiveFailures : 0) + 1

  await storage.setItem(getStorageKey(), {
    ...key,
    consecutiveFailures,
    cooldownUntil: now + getFailureCooldownMs(consecutiveFailures),
  } satisfies SaveSuggestionProviderCooldownState)
}

export async function recordSaveSuggestionSuccess(): Promise<void> {
  await storage.removeItem(getStorageKey())
}
