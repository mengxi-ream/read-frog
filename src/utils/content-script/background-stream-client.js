import { BACKGROUND_STREAM_PORTS } from "@/types/background-stream";
import { createPortStreamPromise } from "./port-streaming";
export function streamBackgroundText(serializablePayload, options = {}) {
    return createPortStreamPromise(BACKGROUND_STREAM_PORTS.streamText, serializablePayload, options);
}
export function streamBackgroundStructuredObject(serializablePayload, options = {}) {
    return createPortStreamPromise(BACKGROUND_STREAM_PORTS.streamStructuredObject, serializablePayload, options);
}
