import type { JSONValue, StreamTextOnErrorCallback } from "ai"
import type { Browser } from "#imports"
import type { AISDKReasoning } from "@/types/config/provider"
import type { SelectionToolbarCustomActionOutputType } from "@/types/config/selection-toolbar"
import type { SaveSuggestionEnvelope } from "@/utils/save-suggestion/types"

interface BaseBackgroundStreamSerializablePayload {
  providerId: string
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

export type BackgroundStreamTextSerializablePayload = BaseBackgroundStreamSerializablePayload

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
  BackgroundStreamSnapshot<SaveSuggestionEnvelope>

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
  | { type: "chunk"; requestId: string; data: T }
  | { type: "done"; requestId: string; data: T }
  | { type: "error"; requestId: string; error: StreamPortErrorPayload }

type DistributiveOmit<T, K extends string> = T extends unknown ? Omit<T, K> : never

export type StreamPortResponseWithoutRequestId<T = string> = DistributiveOmit<
  StreamPortResponse<T>,
  "requestId"
>

export interface StreamPortStartMessage<TSerializablePayload> {
  type: "start"
  requestId: string
  payload: TSerializablePayload
}

export interface StreamPortPingMessage {
  type: "ping"
  requestId: string
}

export type StreamPortRequestMessage<TSerializablePayload> =
  | StreamPortStartMessage<TSerializablePayload>
  | { type: "ping"; requestId: string }

export type StartMessageParseResult<TSerializablePayload> =
  | { success: true; message: StreamPortStartMessage<TSerializablePayload> }
  | { success: false; requestId?: string }

type AISDKStreamTextError = Parameters<StreamTextOnErrorCallback>[0]["error"]

export interface StreamRuntimeOptions<TResponse = unknown> {
  signal?: AbortSignal
  onChunk?: (snapshot: TResponse) => void
  onError?: (error: AISDKStreamTextError) => void
}

export type StreamPortHandler = (port: Browser.runtime.Port) => void
