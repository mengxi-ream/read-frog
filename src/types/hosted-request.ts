import type { HostedAiTextStreamRoute } from "./background-stream"
import type { SerializableProviderRef } from "@/utils/providers/provider-ref"

/** Local calls may omit routing; hosted calls must name the feature they bill. */
export type ProviderRequestRouting<Ref extends SerializableProviderRef = SerializableProviderRef> =
  | { providerRef: Ref; hostedFeature: HostedAiTextStreamRoute }
  | {
      providerRef: Extract<Ref, { kind: "local" }>
      hostedFeature?: undefined
    }
