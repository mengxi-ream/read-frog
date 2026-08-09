import type { ORPCRouterClient } from "@read-frog/api-contract"
import type {
  HostedAiCreditStatus,
  HostedAiFeature,
  HostedAiStatus,
  HostedAiTierStatus,
  HostedAiUnavailableReason,
} from "./types"
import type { HostedAiModelTier } from "@/utils/constants/provider-ids"
import { i18n } from "@/utils/i18n"

/** The one slice of the orpc client this module needs; both proxied clients satisfy it. */
type HostedAiStatusClient = Pick<ORPCRouterClient, "hostedAi">

const STATUS_TTL_MS = 60_000

interface StatusCacheEntry {
  expiresAt: number
  promise: Promise<HostedAiStatus>
}

// Status covers every feature in one response, so a single cache entry serves
// all callers rather than one per feature.
let statusCache: StatusCacheEntry | undefined

export async function getHostedAiStatus(
  client: HostedAiStatusClient,
  options: { force?: boolean } = {},
): Promise<HostedAiStatus> {
  const now = Date.now()
  if (!options.force && statusCache && statusCache.expiresAt > now) {
    return statusCache.promise
  }

  const promise = client.hostedAi.status({})
  const entry: StatusCacheEntry = { expiresAt: now + STATUS_TTL_MS, promise }
  statusCache = entry

  try {
    return await promise
  } catch (error) {
    if (statusCache === entry) {
      statusCache = undefined
    }
    throw error
  }
}

export function clearHostedAiStatusCache(): void {
  statusCache = undefined
}

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

/** `resetAt` as "YYYY-MM-DD HH:mm" in UTC, or null when the timestamp is unparsable. */
export function formatHostedAiResetAtUtc(resetAt: string): string | null {
  const resetDate = new Date(resetAt)
  if (Number.isNaN(resetDate.getTime())) {
    return null
  }
  return resetDate.toISOString().replace("T", " ").slice(0, 16)
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
    details.push(i18n.t(REASON_I18N_KEYS[reason] as never))
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
    const formattedResetAt = formatHostedAiResetAtUtc(credit.resetAt)
    if (formattedResetAt) {
      details.push(i18n.t("hostedAi.availability.resetsAtUtc", [formattedResetAt]))
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
