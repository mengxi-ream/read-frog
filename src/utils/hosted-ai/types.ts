import type { HostedAiStatusOutput } from "@read-frog/api-contract"

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

export type HostedAiStatus = HostedAiStatusOutput
