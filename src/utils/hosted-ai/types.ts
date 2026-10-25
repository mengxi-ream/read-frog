import type {
  HostedAiCreditStatus,
  HostedAiFeature,
  HostedAiStatusOutput,
} from "@read-frog/api-contract"

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
 */
export interface HostedAiCreditGrantStatus {
  periodKind: "once"
  usedPercent: number
  expiresAt: string
  features: HostedAiFeature[]
}

/**
 * One pool that can pay for Built-in AI, told apart by `periodKind`: a plan's
 * `daily` or `weekly` pool has `resetAt`, a `once` grant has `expiresAt`.
 *
 * TODO(2026-11-07): mirrors `HostedAiCreditPoolStatusSchema`, which the
 * published contract does not have yet. Replace these local types with the
 * contract's when it is bumped (mengxi-ream/read-frog-monorepo#710).
 */
export type HostedAiCreditPoolStatus = HostedAiCreditStatus | HostedAiCreditGrantStatus

export type HostedAiStatus = HostedAiStatusOutput & {
  /** Absent from servers that predate it; read it through `getHostedAiPools`. */
  pools?: HostedAiCreditPoolStatus[]
}
