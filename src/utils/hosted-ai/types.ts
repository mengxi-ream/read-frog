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
  HostedAiFeature,
  HostedAiTierStatus,
  HostedAiUnavailableReason,
} from "@read-frog/api-contract"

/** A recurring pool: the plan's credit for a day or a week, refilled at `resetAt`. */
export type HostedAiRecurringCreditStatus = HostedAiCreditStatus

/**
 * A one-time pool, such as credit from a campaign or from support. It never
 * refills: it is spent, or it expires at `expiresAt`. The server draws on it
 * only after the plan's own pool for a feature is spent, or for a feature the
 * plan does not fund.
 */
export interface HostedAiOneTimeCreditStatus {
  periodKind: "once"
  usedPercent: number
  expiresAt: string
  features: HostedAiFeature[]
}

/**
 * One pool that can pay for Built-in AI, told apart by `periodKind`: a
 * recurring `daily` or `weekly` pool has `resetAt`, a one-time (`once`) pool
 * has `expiresAt`.
 *
 * TODO(2026-11-07): the published contract (0.21.1) has no `pools` yet and
 * still calls the recurring pool `HostedAiCreditStatus`. Replace these local
 * types with the contract's `HostedAiRecurringCreditStatus`,
 * `HostedAiOneTimeCreditStatus` and `HostedAiCreditPoolStatus` when it is
 * bumped (mengxi-ream/read-frog-monorepo#710).
 */
export type HostedAiCreditPoolStatus = HostedAiRecurringCreditStatus | HostedAiOneTimeCreditStatus

export type HostedAiStatus = HostedAiStatusOutput & {
  /** Absent from servers that predate it; read it through `getHostedAiPools`. */
  pools?: HostedAiCreditPoolStatus[]
}
