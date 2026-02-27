import type {
  BackgroundStreamResponseMap,
  BackgroundStreamTextPayload,
} from "@/types/background-stream"
import { BACKGROUND_STREAM_PORTS } from "@/types/background-stream"
import { createPortStreamPromise } from "./port-streaming"

export interface ContentScriptTextStreamOptions {
  signal?: AbortSignal
  onChunk?: (data: string) => void
  keepAliveIntervalMs?: number
}

export function streamBackgroundText(
  payload: BackgroundStreamTextPayload,
  options: ContentScriptTextStreamOptions = {},
) {
  return createPortStreamPromise<BackgroundStreamResponseMap["streamText"]>(
    BACKGROUND_STREAM_PORTS.streamText,
    payload,
    options,
  )
}
