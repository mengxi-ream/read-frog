import type {
  AnalyticsFeature,
  BuiltInAiPromptKind as AnalyticsPromptKind,
  BuiltInAiPromptTrigger,
} from "@/types/analytics"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import type { BuiltInAiRefusalKind } from "@/utils/hosted-ai/refusal"
import type { BuiltInAiUpgradePlan } from "@/utils/hosted-ai/upgrade-plan"
import { useSyncExternalStore } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { trackBuiltInAiPromptAction, trackBuiltInAiPromptShown } from "@/utils/analytics"
import { logInAction, upgradeAction } from "@/utils/error-action"
import { getBuiltInAiRefusalKind } from "@/utils/hosted-ai/refusal"
import { getBuiltInAiUpgradePlan } from "@/utils/hosted-ai/upgrade-plan"
import { i18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { sendMessage } from "@/utils/message"

export type { BuiltInAiUpgradePlan } from "@/utils/hosted-ai/upgrade-plan"

const log = createLogger("content-runtime/built-in-ai-prompt")

/**
 * A translate feature that can open the prompt when Built-in AI refuses it: the one whose
 * provider "Use machine translation" switches. Hover translation runs on page
 * translation's provider, and annotation on selection translation's.
 */
export type BuiltInAiPromptFeature = Extract<
  FeatureKey,
  "pageTranslation" | "inputTranslation" | "selectionTranslation" | "videoSubtitles"
>

interface BuiltInAiPromptBase {
  feature: BuiltInAiPromptFeature
  /** The feature that hit the wall, as analytics and the upgrade link name it. */
  analyticsFeature: AnalyticsFeature
  /** Whether someone ran the feature or it ran on its own; analytics only. */
  trigger: BuiltInAiPromptTrigger
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
 * A newer request replaces the open one. Features go through `promptForBuiltInAiRefusal`,
 * which decides whether a refusal gets this dialog at all.
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

/**
 * Whether this frame renders the dialog. The selection UI's dialog is the store's only
 * subscriber, and a frame can run without that UI, as an embedded video player does.
 */
function hasBuiltInAiPromptHost(): boolean {
  return listeners.size > 0
}

export function toAnalyticsPromptKind(kind: BuiltInAiRefusalKind): AnalyticsPromptKind {
  return kind === "logIn" ? "log_in" : "upgrade"
}

export interface BuiltInAiRefusalPromptOptions {
  feature: BuiltInAiPromptFeature
  analyticsFeature: AnalyticsFeature
  /** Whether someone ran the feature or it ran on its own; analytics only. */
  trigger: BuiltInAiPromptTrigger
  retry?: () => void
  /** The refusals this caller asks about; any other kind is left to it. Both by default. */
  kinds?: readonly BuiltInAiRefusalKind[]
  /**
   * Asked once a refusal could open the dialog; false shows the toast with the same
   * button instead. Automatic page translation asks the background, which says yes once
   * a browser session.
   */
  mayOpenDialog?: (kind: BuiltInAiRefusalKind) => boolean | Promise<boolean>
  /**
   * Runs just before the dialog or the toast shows, such as to leave fullscreen, which
   * would hide either one.
   */
  beforePrompt?: () => void | Promise<void>
  /** Checked after each wait: false drops the prompt, as when its run was stopped. */
  isCurrent?: () => boolean
}

function getRefusalMessage(error: unknown, kind: BuiltInAiRefusalKind): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return i18n.t(
    kind === "upgrade"
      ? "hostedAi.availability.quotaExhausted"
      : "hostedAi.availability.authenticationRequired",
  )
}

/** One toast per feature: refusals arriving one after another refresh it rather than stack. */
function getRefusalToastId(feature: AnalyticsFeature): string {
  return `built-in-ai-refusal-${feature}`
}

/**
 * The prompt where there is no room for the dialog: the refusal's own message, with the
 * button the dialog would have led with.
 */
function showRefusalToast(
  title: string,
  kind: BuiltInAiRefusalKind,
  analyticsFeature: AnalyticsFeature,
  trigger: BuiltInAiPromptTrigger,
): void {
  const action =
    kind === "upgrade"
      ? upgradeAction("extension_quota_exhausted", analyticsFeature)
      : logInAction()
  const toastId = toastManager.add({
    id: getRefusalToastId(analyticsFeature),
    type: "error",
    title,
    actionProps: {
      children: action.label,
      onClick: () => {
        toastManager.close(toastId)
        void trackBuiltInAiPromptAction({
          feature: analyticsFeature,
          kind: toAnalyticsPromptKind(kind),
          presentation: "toast",
          trigger,
          action: kind === "upgrade" ? "upgrade" : "log_in",
        })
        // Content scripts cannot use chrome.tabs: route through the background.
        void sendMessage("openPage", { url: action.url, active: true })
      },
    },
  })
}

/**
 * The one way a feature answers a Built-in AI refusal someone can act on: a guest is
 * asked to log in, and an account whose pool is spent to upgrade, either one also offered
 * machine translation. Takes both kinds of refusal: `HostedAiProviderUnavailableError`
 * from the status check before a run, and a server error relayed from the background
 * during it.
 *
 * Opens the dialog where this frame renders it and `mayOpenDialog` agrees; otherwise
 * shows a toast with the same button. Returns false when it showed nothing, so the caller
 * keeps its own message: the error is no refusal, or not a kind this caller asks about,
 * or the account is on Ultra, which has no plan to upgrade to. Returns true otherwise,
 * including when `isCurrent` turned false along the way and the prompt was dropped.
 */
export async function promptForBuiltInAiRefusal(
  error: unknown,
  options: BuiltInAiRefusalPromptOptions,
): Promise<boolean> {
  const { feature, analyticsFeature, trigger, retry, isCurrent = () => true } = options
  const kind = getBuiltInAiRefusalKind(error)
  if (!kind || (options.kinds && !options.kinds.includes(kind))) {
    return false
  }

  let plan: BuiltInAiUpgradePlan | null = null
  if (kind === "upgrade") {
    plan = await getBuiltInAiUpgradePlan()
    if (plan === null) {
      return false
    }
  }
  if (!isCurrent()) {
    return true
  }

  // The same question is already on screen, as when two paragraphs or two hovers run dry
  // together: asking again would only replace it.
  if (currentRequest?.feature === feature && currentRequest.kind === kind) {
    return true
  }

  let presentation: "dialog" | "toast" = "toast"
  if (hasBuiltInAiPromptHost()) {
    try {
      presentation = (await (options.mayOpenDialog?.(kind) ?? true)) ? "dialog" : "toast"
    } catch (mayOpenError) {
      log.warn("Could not tell whether to open the Built-in AI prompt", { error: mayOpenError })
    }
    if (!isCurrent()) {
      return true
    }
  }

  await options.beforePrompt?.()
  if (!isCurrent()) {
    return true
  }

  if (presentation === "dialog") {
    const base = { feature, analyticsFeature, trigger, retry }
    openBuiltInAiPrompt(
      kind === "upgrade" && plan !== null
        ? { ...base, kind: "upgrade", plan }
        : { ...base, kind: "logIn" },
    )
  } else {
    showRefusalToast(getRefusalMessage(error, kind), kind, analyticsFeature, trigger)
  }

  void trackBuiltInAiPromptShown({
    feature: analyticsFeature,
    kind: toAnalyticsPromptKind(kind),
    presentation,
    trigger,
  })
  return true
}
