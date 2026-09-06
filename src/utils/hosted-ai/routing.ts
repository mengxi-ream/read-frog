import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { SerializableProviderRef } from "@/utils/providers/provider-ref"
import { z } from "zod"

export const hostedTextStreamRouteSchema = z.enum([
  "pageTranslation",
  "selectionTranslation",
  "videoSubtitles",
  "videoSubtitlesSegmentation",
  "inputTranslation",
  "languageDetection",
] satisfies HostedAiTextStreamRoute[])

export function requireHostedFeature(value: unknown): HostedAiTextStreamRoute {
  const result = hostedTextStreamRouteSchema.safeParse(value)
  if (!result.success) {
    throw new Error("A valid hostedFeature is required for hosted text requests")
  }
  return result.data
}

export function validateProviderHostedFeature(
  providerRef: SerializableProviderRef,
  hostedFeature: unknown,
): void {
  if (providerRef.kind === "system" || hostedFeature !== undefined) {
    requireHostedFeature(hostedFeature)
  }
}
