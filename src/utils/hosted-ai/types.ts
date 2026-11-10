import type { HostedAiStatusOutput } from "@read-frog/api-contract"

// The wire types live in the contract package; this module only aliases the
// response type to the extension's historical name. Type-only imports are
// erased at build, so no zod code reaches content scripts through this path.
export type {
  HostedAiCreditPeriodKind,
  HostedAiCreditPoolStatus,
  HostedAiFeature,
  HostedAiFeatureStatus,
  HostedAiOneTimeCreditStatus,
  HostedAiRecurringCreditStatus,
  HostedAiTierStatus,
  HostedAiUnavailableReason,
  HostedAiUpgradePlan,
} from "@read-frog/api-contract"

export type HostedAiStatus = HostedAiStatusOutput
