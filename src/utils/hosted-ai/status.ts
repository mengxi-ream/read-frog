import type { HostedAiModel } from "./models"
import type {
  HostedAiCreditPoolStatus,
  HostedAiFeature,
  HostedAiFeatureStatus,
  HostedAiModelTier,
  HostedAiRecurringCreditStatus,
  HostedAiStatus,
  HostedAiTierStatus,
  HostedAiUnavailableReason,
} from "./types"
import { i18n } from "@/utils/i18n"
import { findHostedAiModel, getHostedAiModelsFromStatus } from "./models"

const REASON_I18N_KEYS = {
  authentication_required: "hostedAi.availability.authenticationRequired",
  ultra_required: "hostedAi.availability.ultraRequired",
  pro_required: "hostedAi.availability.proRequired",
  quota_exhausted: "hostedAi.availability.quotaExhausted",
  service_unavailable: "hostedAi.availability.serviceUnavailable",
} as const satisfies Record<HostedAiUnavailableReason, string>

/**
 * Every pool that can pay for Built-in AI, in the order the server draws on
 * them: the plan's recurring pools, then one-time pools.
 */
export function getHostedAiPools(status: HostedAiStatus | undefined): HostedAiCreditPoolStatus[] {
  return status?.pools ?? []
}

/**
 * The recurring pool a feature draws on, or undefined when the plan funds none.
 * One-time pools are left out: a tier description shows when the pool resets,
 * and a one-time pool never does.
 */
export function getHostedAiCreditForFeature(
  status: HostedAiStatus | undefined,
  feature: HostedAiFeature,
): HostedAiRecurringCreditStatus | undefined {
  return getHostedAiPools(status).find(
    (pool): pool is HostedAiRecurringCreditStatus =>
      pool.periodKind !== "once" && pool.features.includes(feature),
  )
}

/**
 * The server reports resets in UTC; render the moment in the user's own
 * timezone and locale conventions — "when do I get quota back" is a
 * wall-clock question, not a protocol one. Null when unparsable. The single
 * formatter for every surface (usage bars, dropdown/toast descriptions), so
 * the same reset instant never shows in two different timezones.
 */
export function formatHostedAiResetAtLocal(resetAt: string): string | null {
  const resetDate = new Date(resetAt)
  if (Number.isNaN(resetDate.getTime())) {
    return null
  }
  return resetDate.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getHostedAiTierDescription(
  status: HostedAiTierStatus | undefined,
  options: { credit?: HostedAiRecurringCreditStatus | null } = {},
): string | undefined {
  if (!status) {
    return i18n.t("hostedAi.availability.serviceUnavailable")
  }
  const details: string[] = []
  if (!status.available) {
    const reason = status.unavailableReason ?? "service_unavailable"
    // The response body is not runtime-validated, so a reason minted by a
    // newer server must fall back instead of rendering "undefined".
    const reasonKey =
      (REASON_I18N_KEYS as Partial<Record<string, string>>)[reason] ??
      REASON_I18N_KEYS.service_unavailable
    details.push(i18n.t(reasonKey as never))
  }
  const credit = options.credit
  if (credit) {
    details.push(
      i18n.t("hostedAi.availability.usedPercent", [
        Math.round(Math.max(0, Math.min(100, credit.usedPercent))),
      ]),
    )
  }
  if (credit?.resetAt) {
    const formattedResetAt = formatHostedAiResetAtLocal(credit.resetAt)
    if (formattedResetAt) {
      details.push(i18n.t("hostedAi.availability.resetsAt", [formattedResetAt]))
    }
  }
  return details.length > 0 ? details.join(" · ") : undefined
}

export function getHostedAiTierStatus(
  status: HostedAiStatus | undefined,
  feature: HostedAiFeature,
  tier: HostedAiModelTier,
): HostedAiTierStatus | undefined {
  // Not every feature has a status entry: PDF translation draws on the credit
  // pools but has no per-tier status, so it reads as undefined here.
  const features: Partial<Record<HostedAiFeature, HostedAiFeatureStatus>> | undefined =
    status?.features
  return features?.[feature]?.[tier]
}

/**
 * Whether a tier's status walls this account off from a feature: it is not
 * signed in, its plan does not reach the tier, or its credit is spent.
 *
 * `service_unavailable` is left out on purpose. On a tier it describes the
 * tier's default model, the one a request that names no model runs; another
 * model of the tier can run regardless, and each model says so itself.
 */
export function isHostedAiTierBlocked(tierStatus: HostedAiTierStatus | undefined): boolean {
  return (
    tierStatus !== undefined &&
    !tierStatus.available &&
    tierStatus.unavailableReason !== "service_unavailable"
  )
}

/**
 * Whether one model can run a feature for this account, as far as a status
 * response tells:
 * - `unknown`: the response lists no models (it could not be fetched, or the
 *   server predates models). Fail open: the server decides when it is asked.
 * - `blocked`: the account cannot run the model's tier for this feature.
 * - `unavailable`: the model is not in the list, or the server says it cannot
 *   run now. `alternatives` are the models this account can run instead, in
 *   the server's order.
 */
export type HostedAiModelVerdict =
  | { kind: "unknown" }
  | { kind: "usable"; model: HostedAiModel; tierStatus: HostedAiTierStatus | undefined }
  | { kind: "blocked"; model: HostedAiModel; tierStatus: HostedAiTierStatus }
  | { kind: "unavailable"; model: HostedAiModel | undefined; alternatives: HostedAiModel[] }

export function getHostedAiModelVerdict(
  status: HostedAiStatus | undefined,
  feature: HostedAiFeature,
  modelId: string,
): HostedAiModelVerdict {
  const models = getHostedAiModelsFromStatus(status)
  if (!models) {
    return { kind: "unknown" }
  }

  const model = findHostedAiModel(models, modelId)
  const tierStatus = model ? getHostedAiTierStatus(status, feature, model.tier) : undefined
  if (model && tierStatus && isHostedAiTierBlocked(tierStatus)) {
    return { kind: "blocked", model, tierStatus }
  }
  if (!model || !model.available) {
    return {
      kind: "unavailable",
      model,
      alternatives: getHostedAiModelAlternatives(status, feature, models, modelId),
    }
  }
  return { kind: "usable", model, tierStatus }
}

/** The models this account can run for a feature right now, other than `exceptModelId`. */
export function getHostedAiModelAlternatives(
  status: HostedAiStatus | undefined,
  feature: HostedAiFeature,
  models: readonly HostedAiModel[],
  exceptModelId: string,
): HostedAiModel[] {
  return models.filter(
    (model) =>
      model.id !== exceptModelId &&
      model.available &&
      !isHostedAiTierBlocked(getHostedAiTierStatus(status, feature, model.tier)),
  )
}
