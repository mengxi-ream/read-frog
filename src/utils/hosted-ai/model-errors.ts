import type { ErrorAction } from "@/utils/error-action"
import { browser } from "#imports"
import { getBuiltInAiProviderId } from "@/utils/constants/provider-ids"
import { formatUiAlternatives, i18n } from "@/utils/i18n"
import { buildProviderConfigRoute } from "@/utils/navigation"

/**
 * A sentence stays readable with a few names in it; the settings the error's
 * button opens list every model.
 */
const MAX_NAMED_ALTERNATIVES = 3

/** The first few names offered as a choice: "A, B, or C". */
export function formatHostedAiModelAlternatives(alternativeNames: readonly string[]): string {
  return formatUiAlternatives(alternativeNames.slice(0, MAX_NAMED_ALTERNATIVES))
}

const formatAlternatives = formatHostedAiModelAlternatives

/** "GPT-6.2 Sol can't run right now. Try Claude Haiku 5.5 or GPT-6 Luna instead." */
export function getHostedAiModelUnavailableMessage(
  modelName: string,
  alternativeNames: readonly string[],
): string {
  return alternativeNames.length > 0
    ? i18n.t("hostedAi.errors.modelUnavailable", [modelName, formatAlternatives(alternativeNames)])
    : i18n.t("hostedAi.errors.modelUnavailableNoAlternatives", [modelName])
}

/**
 * Why a model picked in a menu or on the settings page cannot run, and what to
 * pick instead: the text of its warning icon's tooltip and accessible name.
 */
export function getHostedAiModelUnavailableReason(
  modelName: string,
  unavailability: "temporary" | "removed",
  alternativeNames: readonly string[],
): string {
  if (unavailability === "removed") {
    return alternativeNames.length > 0
      ? i18n.t("hostedAi.unavailable.removed", [modelName, formatAlternatives(alternativeNames)])
      : i18n.t("hostedAi.unavailable.removedNoAlternatives", [modelName])
  }
  return alternativeNames.length > 0
    ? i18n.t("hostedAi.unavailable.temporary", [modelName, formatAlternatives(alternativeNames)])
    : i18n.t("hostedAi.unavailable.temporaryNoAlternatives", [modelName])
}

/** Every provider of the model is at its rate limit: waiting works, and so does another model. */
export function getHostedAiModelBusyMessage(
  modelName: string,
  alternativeNames: readonly string[],
): string {
  return alternativeNames.length > 0
    ? i18n.t("hostedAi.errors.modelBusy", [modelName, formatAlternatives(alternativeNames)])
    : i18n.t("hostedAi.errors.modelBusyNoAlternatives", [modelName])
}

/**
 * Opens the API provider settings on the model to switch to, where one switch
 * assigns it to the feature that failed. A way to switch, never a switch: the
 * user picks the model, so nobody's output or credit changes behind their back.
 * With no alternative, it opens on the model that failed.
 */
export function chooseHostedAiModelAction(modelId: string): ErrorAction {
  const route = buildProviderConfigRoute(getBuiltInAiProviderId(modelId))
  return {
    label: i18n.t("hostedAi.actions.chooseModel"),
    url: browser.runtime.getURL(`/options.html#${route}`),
  }
}
