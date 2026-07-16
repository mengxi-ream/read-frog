export const EXTENSION_STATUS_REQUEST_SOURCE = "read-frog-page"
export const EXTENSION_STATUS_RESPONSE_SOURCE = "read-frog-ext"
export const EXTENSION_STATUS_REQUEST_TYPE = "getExtensionStatus"
export const EXTENSION_STATUS_RESPONSE_TYPE = "extensionStatus"

interface ExtensionStatusMessageEvent {
  data: unknown
  source: unknown
}

export interface ExtensionStatusResponse {
  source: typeof EXTENSION_STATUS_RESPONSE_SOURCE
  type: typeof EXTENSION_STATUS_RESPONSE_TYPE
  requestId: string
  data: {
    version: string
  }
}

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
