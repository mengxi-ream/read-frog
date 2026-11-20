import type { FeatureKey } from "@/utils/constants/feature-providers"
import { useSyncExternalStore } from "react"

/** A translate feature that opens the prompt when a guest runs it on Built-in AI. */
export type GuestSignInPromptFeature = Extract<FeatureKey, "pageTranslation" | "inputTranslation">

export interface GuestSignInPromptRequest {
  feature: GuestSignInPromptFeature
  /** Runs the feature again after it has switched to the machine translator. */
  retry?: () => void
}

let currentRequest: GuestSignInPromptRequest | null = null
const listeners = new Set<() => void>()

function setRequest(request: GuestSignInPromptRequest | null) {
  currentRequest = request
  listeners.forEach((listener) => listener())
}

/**
 * Asks a guest who ran a translate feature on Built-in AI to log in, or to switch that
 * feature to a machine translator that needs no account. Any part of the content runtime
 * can open it; the selection UI renders it (`GuestSignInDialog`). A newer request replaces
 * the open one.
 */
export function openGuestSignInPrompt(request: GuestSignInPromptRequest): void {
  setRequest(request)
}

export function closeGuestSignInPrompt(): void {
  setRequest(null)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useGuestSignInPrompt(): GuestSignInPromptRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => currentRequest,
    () => null,
  )
}
