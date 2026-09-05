import type { HostedAiFeature } from "@read-frog/api-contract"
import type { JSONValue, StreamTextOnErrorCallback } from "ai"
import type { Browser } from "#imports"
import type { AISDKReasoning, LLMProviderConfig } from "@/types/config/provider"
import type { SelectionToolbarCustomActionOutputType } from "@/types/config/selection-toolbar"
import type { BuiltInAiProviderId, HostedAiModelTier } from "@/utils/constants/provider-ids"
import type { NoteSuggestionEnvelope } from "@/utils/note-suggestion/types"

interface BaseBackgroundStreamSerializablePayload {
  providerId: string
  modelTier?: HostedAiModelTier
  /** Hosted billing idempotency key. Ignored by local/BYOK providers. */
  requestId?: string
  instructions?: string
  prompt?: string
  messages?: JSONValue[]
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  frequencyPenalty?: number
  presencePenalty?: number
  seed?: number
  stopSequences?: string[]
  reasoning?: AISDKReasoning
  providerOptions?: Record<string, Record<string, JSONValue>>
}

/** The hosted features that stream plain text through the `stream-text` port. */
export type HostedAiTextStreamFeature = Extract<
  HostedAiFeature,
  | "pageTranslation"
  | "selectionTranslation"
  | "videoSubtitles"
  | "inputTranslation"
  | "languageDetection"
>

/**
 * Which hosted text route to call — normally one per feature, but video
 * subtitles has two: line/summary translation and segmentation, which is a
 * separate route because it carries a much larger output budget (and so a
 * larger credit reservation) than a subtitle line should ever reserve.
 *
 * So this is a superset of `HostedAiTextStreamFeature`: the server still bills
 * both subtitle routes against the single `videoSubtitles` feature.
 */
export type HostedAiTextStreamRoute = HostedAiTextStreamFeature | "videoSubtitlesSegmentation"

export type BackgroundStreamTextSerializablePayload = BaseBackgroundStreamSerializablePayload &
  (
    | {
        providerKind: "local"
        /** Model and generation settings captured with the caller's cache identity. */
        providerConfig?: LLMProviderConfig
        hostedFeature?: never
      }
    | {
        providerKind: "system"
        providerId: BuiltInAiProviderId
        providerConfig?: never
        hostedFeature: HostedAiTextStreamRoute
      }
  )

export interface BackgroundStructuredObjectOutputField {
  name: string
  type: SelectionToolbarCustomActionOutputType
}

export interface ThinkingSnapshot {
  status: "thinking" | "complete"
  text: string
}

export interface BackgroundStreamSnapshot<TOutput> {
  output: TOutput
  thinking: ThinkingSnapshot
}

export type BackgroundTextStreamSnapshot = BackgroundStreamSnapshot<string>

export type BackgroundStructuredObjectStreamSnapshot = BackgroundStreamSnapshot<
  Record<string, unknown>
>

export type BackgroundStreamStructuredObjectSerializablePayload =
  BaseBackgroundStreamSerializablePayload & {
    outputSchema: BackgroundStructuredObjectOutputField[]
  }

export type BackgroundStreamNoteSuggestionSerializablePayload =
  BaseBackgroundStreamSerializablePayload

export type BackgroundNoteSuggestionStreamSnapshot =
  BackgroundStreamSnapshot<NoteSuggestionEnvelope>

export const BACKGROUND_STREAM_PORTS = {
  streamText: "stream-text",
  streamStructuredObject: "stream-structured-object",
  streamNoteSuggestion: "stream-note-suggestion",
} as const

export type BackgroundStreamChannel = keyof typeof BACKGROUND_STREAM_PORTS
export type BackgroundStreamPortName = (typeof BACKGROUND_STREAM_PORTS)[BackgroundStreamChannel]

export interface BackgroundStreamResponseMap {
  streamText: BackgroundTextStreamSnapshot
  streamStructuredObject: BackgroundStructuredObjectStreamSnapshot
  streamNoteSuggestion: BackgroundNoteSuggestionStreamSnapshot
}

export interface StreamPortErrorPayload {
  message: string
}

export type StreamPortResponse<T = string> =
  | { type: "chunk"; streamRequestId: string; data: T }
  | { type: "done"; streamRequestId: string; data: T }
  | { type: "error"; streamRequestId: string; error: StreamPortErrorPayload }

type DistributiveOmit<T, K extends string> = T extends unknown ? Omit<T, K> : never

export type StreamPortResponseWithoutStreamRequestId<T = string> = DistributiveOmit<
  StreamPortResponse<T>,
  "streamRequestId"
>

export interface StreamPortStartMessage<TSerializablePayload> {
  type: "start"
  streamRequestId: string
  payload: TSerializablePayload
}

export interface StreamPortPingMessage {
  type: "ping"
  streamRequestId: string
}

export type StreamPortRequestMessage<TSerializablePayload> =
  | StreamPortStartMessage<TSerializablePayload>
  | { type: "ping"; streamRequestId: string }

export type StartMessageParseResult<TSerializablePayload> =
  | { success: true; message: StreamPortStartMessage<TSerializablePayload> }
  | { success: false; streamRequestId?: string }

type AISDKStreamTextError = Parameters<StreamTextOnErrorCallback>[0]["error"]

export interface StreamRuntimeOptions<TResponse = unknown> {
  signal?: AbortSignal
  onChunk?: (snapshot: TResponse) => void
  onError?: (error: AISDKStreamTextError) => void
}

export type StreamPortHandler = (port: Browser.runtime.Port) => void
