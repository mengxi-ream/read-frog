import type { HostedAiStatusOutput } from "@read-frog/api-contract"

// The wire types live in the contract package; this module only aliases the
// response type to the extension's historical name. Type-only imports are
// erased at build, so no zod code reaches content scripts through this path.
export type {
  HostedAiCreditPeriodKind,
  HostedAiCreditPoolStatus,
  HostedAiFeature,
  HostedAiOneTimeCreditStatus,
  HostedAiRecurringCreditStatus,
  HostedAiTierStatus,
  HostedAiUnavailableReason,
} from "@read-frog/api-contract"

/**
 * TODO(2026-11-07): `pools` is optional only because a server that predates it
 * omits it and `getHostedAiPools` falls back to `credits`. Use
 * `HostedAiStatusOutput` as is once that fallback goes
 * (mengxi-ream/read-frog-monorepo#710).
 */
export type HostedAiStatus = Omit<HostedAiStatusOutput, "pools"> & {
  pools?: HostedAiStatusOutput["pools"]
}
