import type { HostedAiFeature, HostedAiStatusOutput } from "@read-frog/api-contract"

// The wire types live in the contract package; this module only aliases the
// response type to the extension's historical name. Type-only imports are
// erased at build, so no zod code reaches content scripts through this path.
export type {
  HostedAiCreditPeriodKind,
  HostedAiCreditStatus,
  HostedAiFeature,
  HostedAiTierStatus,
  HostedAiUnavailableReason,
} from "@read-frog/api-contract"

/**
 * A one-time grant of Built-in AI credit. It never resets: it is spent, or it
 * expires at `expiresAt`. The server draws on it only after the plan's own pool
 * for a feature is spent, or for a feature the plan does not fund.
 *
 * Mirrors `HostedAiCreditGrantStatusSchema`, which the published contract does
 * not have yet. Replace with the contract's type when it is bumped.
 */
export interface HostedAiCreditGrantStatus {
  usedPercent: number
  expiresAt: string
  features: HostedAiFeature[]
}

export type HostedAiStatus = HostedAiStatusOutput & {
  /** Absent from servers that predate grants; read it as `grants ?? []`. */
  grants?: HostedAiCreditGrantStatus[]
}
