import type {
  BackgroundStreamNoteSuggestionSerializablePayload,
  BackgroundStreamResponseMap,
  BackgroundStreamStructuredObjectSerializablePayload,
  BackgroundStreamTextSerializablePayload,
} from "@/types/background-stream"
import { BACKGROUND_STREAM_PORTS } from "@/types/background-stream"
import { createPortStreamPromise } from "./port-streaming"

export interface ContentScriptStreamOptions<TResponse = string> {
  signal?: AbortSignal
  onChunk?: (data: TResponse) => void
  keepAliveIntervalMs?: number
}

export function streamBackgroundText(
  serializablePayload: BackgroundStreamTextSerializablePayload,
  options: ContentScriptStreamOptions<BackgroundStreamResponseMap["streamText"]> = {},
) {
  return createPortStreamPromise<BackgroundStreamResponseMap["streamText"]>(
    BACKGROUND_STREAM_PORTS.streamText,
    serializablePayload,
    options,
  )
}

export function streamBackgroundStructuredObject(
  serializablePayload: BackgroundStreamStructuredObjectSerializablePayload,
  options: ContentScriptStreamOptions<BackgroundStreamResponseMap["streamStructuredObject"]> = {},
) {
  return createPortStreamPromise<BackgroundStreamResponseMap["streamStructuredObject"]>(
    BACKGROUND_STREAM_PORTS.streamStructuredObject,
    serializablePayload,
    options,
  )
}

export function streamBackgroundNoteSuggestion(
  serializablePayload: BackgroundStreamNoteSuggestionSerializablePayload,
  options: ContentScriptStreamOptions<BackgroundStreamResponseMap["streamNoteSuggestion"]> = {},
) {
  return createPortStreamPromise<BackgroundStreamResponseMap["streamNoteSuggestion"]>(
    BACKGROUND_STREAM_PORTS.streamNoteSuggestion,
    serializablePayload,
    options,
  )
}
