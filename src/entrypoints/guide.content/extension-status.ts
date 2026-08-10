import type { ExtensionStatusResponse } from "@read-frog/definitions"
import {
  EXTENSION_STATUS_REQUEST_SOURCE,
  EXTENSION_STATUS_REQUEST_TYPE,
  EXTENSION_STATUS_RESPONSE_SOURCE,
  EXTENSION_STATUS_RESPONSE_TYPE,
} from "@read-frog/definitions"

interface ExtensionStatusMessageEvent {
  data: unknown
  source: unknown
}

export {
  EXTENSION_STATUS_REQUEST_SOURCE,
  EXTENSION_STATUS_REQUEST_TYPE,
  EXTENSION_STATUS_RESPONSE_SOURCE,
  EXTENSION_STATUS_RESPONSE_TYPE,
}
export type { ExtensionStatusResponse }

export function createExtensionStatusResponse(
  event: ExtensionStatusMessageEvent,
  pageWindow: unknown,
  version: string,
): ExtensionStatusResponse | null {
  if (event.source !== pageWindow || !isRecord(event.data)) {
    return null
  }

  const { requestId, source, type } = event.data
  if (
    source !== EXTENSION_STATUS_REQUEST_SOURCE ||
    type !== EXTENSION_STATUS_REQUEST_TYPE ||
    typeof requestId !== "string" ||
    requestId.length === 0
  ) {
    return null
  }

  return {
    source: EXTENSION_STATUS_RESPONSE_SOURCE,
    type: EXTENSION_STATUS_RESPONSE_TYPE,
    requestId,
    data: { version },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
