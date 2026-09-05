import type { z } from "zod"
import type { TranslateBatchData } from "@/entrypoints/background/translation-queues"
import type { BackgroundGenerateTextPayload } from "@/types/background-generate-text"
import type {
  BackgroundStreamTextSerializablePayload,
  HostedAiTextStreamRoute,
} from "@/types/background-stream"
import type { ProviderRequestRouting } from "@/types/hosted-request"
import type { SerializableProviderRef } from "@/utils/providers/provider-ref"
import { describe, expect, expectTypeOf, it } from "vitest"
import { hostedTextStreamRouteSchema, requireHostedFeature } from "../routing"

type SystemRef = Extract<SerializableProviderRef, { kind: "system" }>
type LocalRef = Extract<SerializableProviderRef, { kind: "local" }>

describe("hosted request routing", () => {
  it("requires explicit routing in hosted stream, generation, message and queue types", () => {
    expectTypeOf<{
      providerKind: "system"
      providerId: "read-frog-free-ai"
    }>().not.toMatchTypeOf<BackgroundStreamTextSerializablePayload>()
    expectTypeOf<{
      providerKind: "system"
      providerId: "read-frog-free-ai"
      hostedFeature: "videoSubtitles"
    }>().toMatchTypeOf<BackgroundStreamTextSerializablePayload>()
    expectTypeOf<{ providerRef: SystemRef }>().not.toMatchTypeOf<ProviderRequestRouting>()
    expectTypeOf<{
      providerRef: SystemRef
      instructions: string
      prompt: string
    }>().not.toMatchTypeOf<BackgroundGenerateTextPayload>()
    expectTypeOf<
      Omit<TranslateBatchData, "provider" | "hostedFeature"> & { provider: SystemRef }
    >().not.toMatchTypeOf<TranslateBatchData>()
  })

  it("allows local stream and message requests without hosted routing", () => {
    expectTypeOf<{
      providerKind: "local"
      providerId: string
    }>().toMatchTypeOf<BackgroundStreamTextSerializablePayload>()
    expectTypeOf<{ providerRef: LocalRef }>().toMatchTypeOf<ProviderRequestRouting>()
  })

  it("validates exactly the supported text routes", () => {
    expectTypeOf<
      z.infer<typeof hostedTextStreamRouteSchema>
    >().toEqualTypeOf<HostedAiTextStreamRoute>()
    for (const route of hostedTextStreamRouteSchema.options) {
      expect(requireHostedFeature(route)).toBe(route)
    }
  })

  it.each([undefined, null, "", "unknownFeature", "toString", 123])(
    "rejects an absent or invalid feature (%s)",
    (feature) => {
      expect(() => requireHostedFeature(feature)).toThrow("valid hostedFeature is required")
    },
  )
})
