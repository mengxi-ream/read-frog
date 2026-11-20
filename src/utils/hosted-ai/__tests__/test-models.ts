import type { HostedAiModelStatus } from "@/utils/hosted-ai/types"

/**
 * One entry of `hostedAi.status.models` as the server's catalog sends it,
 * naming the model's maker in `vendor`. The contract this build compiles
 * against does not type `vendor` yet, which is why the extension reads it only
 * when it is a non-empty string.
 */
export type TestHostedAiModelStatus = HostedAiModelStatus & { vendor: string }

/**
 * `hostedAi.status.models` as the server's catalog first shipped it, in its
 * order. Tests use these instead of made-up models so names, tiers and
 * reasoning levels look like what users see.
 */
export const TEST_HOSTED_AI_MODELS = [
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    vendor: "anthropic",
    tier: "normal",
    modelRevision: "claude-haiku-5-5-r1",
    reasoning: { levels: ["none", "low", "medium", "high"], default: "none" },
    available: true,
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    vendor: "openai",
    tier: "normal",
    modelRevision: "gpt-6-luna-r1",
    reasoning: { levels: ["none", "low", "medium", "high", "xhigh"], default: "none" },
    available: true,
  },
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    vendor: "deepseek",
    tier: "normal",
    modelRevision: "deepseek-v4.1-flash-r1",
    reasoning: { levels: ["none", "low", "medium", "high"], default: "none" },
    available: true,
  },
  {
    id: "gpt-6.2-sol",
    name: "GPT-6.2 Sol",
    vendor: "openai",
    tier: "advance",
    modelRevision: "gpt-6.2-sol-r1",
    reasoning: { levels: ["low", "medium", "high", "xhigh"], default: "low" },
    available: true,
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    vendor: "anthropic",
    tier: "advance",
    modelRevision: "claude-sonnet-5-5-r1",
    reasoning: { levels: ["low", "medium", "high"], default: "low" },
    available: true,
  },
] as const satisfies readonly TestHostedAiModelStatus[]

export type TestHostedAiModelId = (typeof TEST_HOSTED_AI_MODELS)[number]["id"]

/** A fresh copy of the catalog, each model changed by `overrides` where named. */
export function testHostedAiModels(
  overrides: Partial<Record<TestHostedAiModelId, Partial<TestHostedAiModelStatus>>> = {},
): TestHostedAiModelStatus[] {
  return TEST_HOSTED_AI_MODELS.map((model) => ({
    ...structuredClone(model),
    reasoning: { levels: [...model.reasoning.levels], default: model.reasoning.default },
    ...overrides[model.id],
  }))
}

export const LUNA_PROVIDER_ID = "read-frog-ai:gpt-6-luna"
export const SOL_PROVIDER_ID = "read-frog-ai:gpt-6.2-sol"
