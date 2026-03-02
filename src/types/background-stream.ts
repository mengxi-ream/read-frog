import type { Browser } from "#imports"
import type { JSONValue, StreamTextOnErrorCallback } from "ai"
import type { SelectionToolbarCustomFeatureOutputType } from "@/types/config/selection-toolbar"

interface BaseBackgroundStreamSerializablePayload {
  providerId: string
  system?: string
  prompt?: string
  messages?: JSONValue[]
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  frequencyPenalty?: number
  presencePenalty?: number
  seed?: number
  stopSequences?: string[]
  providerOptions?: Record<string, Record<string, JSONValue>>
}

export type BackgroundStreamTextSerializablePayload = BaseBackgroundStreamSerializablePayload

export interface BackgroundStructuredObjectOutputField {
  name: string
  type: SelectionToolbarCustomFeatureOutputType
}

export type BackgroundStreamStructuredObjectSerializablePayload = BaseBackgroundStreamSerializablePayload & {
  outputSchema: BackgroundStructuredObjectOutputField[]
}

export const BACKGROUND_STREAM_PORTS = {
  streamText: "stream-text",
  streamStructuredObject: "stream-structured-object",
} as const

export type BackgroundStreamChannel = keyof typeof BACKGROUND_STREAM_PORTS
export type BackgroundStreamPortName = (typeof BACKGROUND_STREAM_PORTS)[BackgroundStreamChannel]

export interface BackgroundStreamResponseMap {
  streamText: string
  streamStructuredObject: Record<string, unknown>
}

export interface StreamPortErrorPayload {
  message: string
}

export type StreamPortResponse<T = string>
  = | { type: "chunk", requestId: string, data: T }
    | { type: "done", requestId: string, data: T }
    | { type: "error", requestId: string, error: StreamPortErrorPayload }

type DistributiveOmit<T, K extends string> = T extends unknown ? Omit<T, K> : never

export type StreamPortResponseWithoutRequestId<T = string> = DistributiveOmit<StreamPortResponse<T>, "requestId">

export interface StreamPortStartMessage<TSerializablePayload> {
  type: "start"
  requestId: string
  payload: TSerializablePayload
}

export interface StreamPortPingMessage {
  type: "ping"
  requestId: string
}

export type StreamPortRequestMessage<TSerializablePayload>
  = StreamPortStartMessage<TSerializablePayload> | { type: "ping", requestId: string }

export type StartMessageParseResult<TSerializablePayload>
  = | { success: true, message: StreamPortStartMessage<TSerializablePayload> }
    | { success: false, requestId?: string }

type AISDKStreamTextError = Parameters<StreamTextOnErrorCallback>[0]["error"]

export interface StreamRuntimeOptions<TChunk = unknown, TResponse = unknown> {
  signal?: AbortSignal
  onChunk?: (chunk: TChunk, cumulativeResponse: TResponse) => void
  onError?: (error: AISDKStreamTextError) => void
}

export type StreamPortHandler = (port: Browser.runtime.Port) => void
