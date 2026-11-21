import { classifyFailureReason } from "@/utils/analytics-failure-reason"
import { HostedAiProviderUnavailableError } from "@/utils/providers/provider-ref"

/**
 * A Built-in AI refusal someone can act on: a guest can log in (`logIn`), and an
 * account whose pool is spent can upgrade (`upgrade`). Any other failure, such as a
 * model that is down, is not one.
 */
export type BuiltInAiRefusalKind = "logIn" | "upgrade"

/**
 * Reads a refusal from either side of a Built-in AI run: the status check before it,
 * which throws `HostedAiProviderUnavailableError` with the server's reason, and the
 * server during it, whose error reaches the content script relayed from the background
 * with its code still on it. Null for anything else.
 */
export function getBuiltInAiRefusalKind(error: unknown): BuiltInAiRefusalKind | null {
  if (error instanceof HostedAiProviderUnavailableError) {
    switch (error.reason) {
      case "authentication_required":
        return "logIn"
      case "quota_exhausted":
        return "upgrade"
      default:
        return null
    }
  }

  switch (classifyFailureReason(error)) {
    case "auth_required":
      return "logIn"
    case "quota_exceeded":
      return "upgrade"
    default:
      return null
  }
}
