import type {
  HostedAiCreditStatus,
  HostedAiFeature,
  HostedAiStatus,
  HostedAiTierStatus,
  HostedAiUnavailableReason,
} from "./types"
import type { HostedAiModelTier } from "@/utils/constants/provider-ids"
import { i18n } from "@/utils/i18n"

const REASON_I18N_KEYS = {
  authentication_required: "hostedAi.availability.authenticationRequired",
  ultra_required: "hostedAi.availability.ultraRequired",
  quota_exhausted: "hostedAi.availability.quotaExhausted",
  service_unavailable: "hostedAi.availability.serviceUnavailable",
} as const satisfies Record<HostedAiUnavailableReason, string>

/** The pool a feature draws on, or undefined when nothing funds it. */
export function getHostedAiCreditForFeature(
  status: HostedAiStatus | undefined,
  feature: HostedAiFeature,
): HostedAiCreditStatus | undefined {
  return status?.credits.find((credit) => credit.features.includes(feature))
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
  options: { credit?: HostedAiCreditStatus | null } = {},
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
  return status?.features[feature]?.[tier]
}
