import { describe, expect, it } from "vitest"
import {
  createExtensionStatusResponse,
  EXTENSION_STATUS_REQUEST_SOURCE,
  EXTENSION_STATUS_REQUEST_TYPE,
} from "./extension-status"

describe("extension status bridge", () => {
  const pageWindow = {}

  it("echoes a valid request id with the extension version", () => {
    expect(
      createExtensionStatusResponse(
        {
          source: pageWindow,
          data: {
            source: EXTENSION_STATUS_REQUEST_SOURCE,
            type: EXTENSION_STATUS_REQUEST_TYPE,
            requestId: "request-1",
          },
        },
        pageWindow,
        "1.33.12",
      ),
    ).toEqual({
      source: "read-frog-ext",
      type: "extensionStatus",
      requestId: "request-1",
      data: { version: "1.33.12" },
    })
  })

  it("ignores messages from another window", () => {
    expect(
      createExtensionStatusResponse(
        {
          source: {},
          data: {
            source: EXTENSION_STATUS_REQUEST_SOURCE,
            type: EXTENSION_STATUS_REQUEST_TYPE,
            requestId: "request-1",
          },
        },
        pageWindow,
        "1.33.12",
      ),
    ).toBeNull()
  })

  it("ignores malformed and unrelated messages", () => {
    expect(
      createExtensionStatusResponse(
        {
          source: pageWindow,
          data: {
            source: EXTENSION_STATUS_REQUEST_SOURCE,
            type: "getPinState",
            requestId: "request-1",
          },
        },
        pageWindow,
        "1.33.12",
      ),
    ).toBeNull()

    expect(
      createExtensionStatusResponse(
        {
          source: pageWindow,
          data: {
            source: EXTENSION_STATUS_REQUEST_SOURCE,
            type: EXTENSION_STATUS_REQUEST_TYPE,
          },
        },
        pageWindow,
        "1.33.12",
      ),
    ).toBeNull()
  })
})
