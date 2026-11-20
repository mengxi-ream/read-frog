import type { FeatureKey } from "@/utils/constants/feature-providers"
import { useSyncExternalStore } from "react"
import { createLogger } from "@/utils/logging/logger"
import { orpcClient } from "@/utils/orpc/client"

const log = createLogger("content-runtime/built-in-ai-prompt")

/** A translate feature that can open the prompt when Built-in AI refuses it. */
export type BuiltInAiPromptFeature = Extract<FeatureKey, "pageTranslation" | "inputTranslation">

interface BuiltInAiPromptBase {
  feature: BuiltInAiPromptFeature
  /** Runs the feature again after it has switched to the machine translator. */
  retry?: () => void
}

/**
 * Why Built-in AI refused, and so what the prompt offers besides machine translation:
 * a guest has no account to bill (`logIn`), or the plan's pool is spent and a larger
 * plan has more (`upgrade`). `plan` is the plan the account is on; it decides which
 * plans the prompt names. Ultra has nothing above it and never gets this prompt.
 */
export type BuiltInAiPromptRequest = BuiltInAiPromptBase &
  ({ kind: "logIn" } | { kind: "upgrade"; plan: BuiltInAiUpgradePlan })

/** A plan with a bigger one above it. */
export type BuiltInAiUpgradePlan = "free" | "pro"

/**
 * The plan of an account whose pool is spent, for the upgrade prompt, or null when it is
 * on Ultra: nothing sits above Ultra, so it gets no upgrade prompt and its caller keeps its
 * own message. A plan that can't be read counts as Free, since nearly everyone who runs dry
 * is on Free.
 */
export async function getBuiltInAiUpgradePlan(): Promise<BuiltInAiUpgradePlan | null> {
  try {
    const { plan } = await orpcClient.billing.status()
    return plan === "ultra" ? null : plan
  } catch (error) {
    log.warn("Could not read the plan for the upgrade prompt", { error })
    return "free"
  }
}

let currentRequest: BuiltInAiPromptRequest | null = null
const listeners = new Set<() => void>()

function setRequest(request: BuiltInAiPromptRequest | null) {
  currentRequest = request
  listeners.forEach((listener) => listener())
}

/**
 * Asks someone whose translate feature Built-in AI refused to log in or upgrade, or to
 * switch that feature to a machine translator that needs no account. Any part of the
 * content runtime can open it; the selection UI renders it (`BuiltInAiPromptDialog`).
 * A newer request replaces the open one.
 */
export function openBuiltInAiPrompt(request: BuiltInAiPromptRequest): void {
  setRequest(request)
}

export function closeBuiltInAiPrompt(): void {
  setRequest(null)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useBuiltInAiPrompt(): BuiltInAiPromptRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => currentRequest,
    () => null,
  )
}
