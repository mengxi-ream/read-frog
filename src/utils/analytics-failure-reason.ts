import type { AnalyticsFailureReason } from "@/types/analytics"
import { ANALYTICS_FAILURE_REASONS } from "@/types/analytics"
import { PROVIDER_SETUP_ERROR_NAME } from "@/utils/providers/provider-setup-error"

const FAILURE_REASONS: ReadonlySet<string> = new Set(ANALYTICS_FAILURE_REASONS)

// Error codes from the background's stream errors and hosted-AI normalization,
// and from oRPC.
const REASON_BY_CODE = new Map<string, AnalyticsFailureReason>([
  ["HOSTED_AI_TIER_RESTRICTED", "tier_restricted"],
  ["HOSTED_AI_QUOTA_EXHAUSTED", "quota_exceeded"],
  ["output_validation_failed", "invalid_output"],
  ["invalid_request", "precheck"],
  ["UNAUTHORIZED", "auth_required"],
  ["TOO_MANY_REQUESTS", "rate_limited"],
  ["NOTE_LIMIT_EXCEEDED", "note_limit"],
  ["NOT_FOUND", "not_found"],
  ["NOTEBASE_NOT_FOUND", "not_found"],
  ["BAD_REQUEST", "validation"],
  ["CELL_VALIDATION_FAILED", "validation"],
])

// The browsers' fetch network failures (Chrome, Firefox, Safari). Matched by
// name and message rather than `instanceof`: an error relayed from the
// background arrives as a plain Error that keeps only its name, and other
// TypeErrors that merely mention fetch (a malformed base URL, a non-Latin-1
// header value) are broken setups, not outages.
const NETWORK_ERROR_MESSAGE =
  /^(?:Failed to fetch|NetworkError when attempting to fetch resource|Load failed)/

const MAX_CAUSE_DEPTH = 5

function readProperty(value: object, key: string): unknown {
  return key in value ? (value as Record<string, unknown>)[key] : undefined
}

function reasonFromErrorName(error: object): AnalyticsFailureReason | undefined {
  switch (readProperty(error, "name")) {
    case PROVIDER_SETUP_ERROR_NAME:
    case "AI_LoadSettingError":
      return "precheck"
    case "AI_LoadAPIKeyError":
      return "missing_api_key"
    case "AI_NoObjectGeneratedError":
    case "AI_TypeValidationError":
    case "AI_JSONParseError":
      return "invalid_output"
    case "AI_APICallError": {
      const statusCode = readProperty(error, "statusCode")
      if (statusCode === 401 || statusCode === 403) return "provider_auth"
      if (statusCode === 429) return "rate_limited"
      return "provider_error"
    }
    default:
      return undefined
  }
}

/**
 * Classifies a failed attempt for analytics. Walks the cause chain, since the
 * background wraps provider errors, and returns "unknown" rather than guessing.
 */
export function classifyFailureReason(error: unknown): AnalyticsFailureReason {
  let current: unknown = error
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== "object" || current === null) {
      break
    }

    // Errors relayed from the background already carry the classification.
    const reason = readProperty(current, "reason")
    if (typeof reason === "string" && FAILURE_REASONS.has(reason)) {
      return reason as AnalyticsFailureReason
    }

    const code = readProperty(current, "code")
    const reasonFromCode = typeof code === "string" ? REASON_BY_CODE.get(code) : undefined
    if (reasonFromCode) {
      return reasonFromCode
    }

    const reasonFromName = reasonFromErrorName(current)
    if (reasonFromName) {
      return reasonFromName
    }

    const message = readProperty(current, "message")
    if (
      readProperty(current, "name") === "TypeError" &&
      typeof message === "string" &&
      NETWORK_ERROR_MESSAGE.test(message)
    ) {
      return "network"
    }

    // The AI SDK's RetryError, thrown once retries run out, keeps the
    // provider's error in `lastError` rather than `cause`.
    current = readProperty(current, "cause") ?? readProperty(current, "lastError")
  }

  return "unknown"
}
