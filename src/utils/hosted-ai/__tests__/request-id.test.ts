import { defineExtensionMessaging } from "@webext-core/messaging"
import { afterEach, describe, expect, it, vi } from "vitest"
import { StreamPortError } from "@/utils/content-script/port-streaming"
import {
  BUILT_IN_AI_REQUEST_ID_FIELD,
  getBuiltInAiRequestId,
  resolveBuiltInAiRequestId,
} from "../request-id"

const SENT_ID = "123e4567-e89b-42d3-a456-426614174000"
const SERVER_ID = "0b9a1c52-6f1e-4d1f-9a54-1f7e9c2d3b4a"

function orpcError(data: unknown) {
  return Object.assign(new Error("Internal server error"), {
    code: "INTERNAL_SERVER_ERROR",
    status: 500,
    data,
  })
}

describe("resolveBuiltInAiRequestId", () => {
  it("prefers the id the server's error names", () => {
    expect(resolveBuiltInAiRequestId(orpcError({ requestId: SERVER_ID }), SENT_ID)).toBe(SERVER_ID)
  })

  it("finds the server's id on an error the background wrapped", () => {
    const wrapped = new Error("Built-in AI is busy", {
      cause: orpcError({ requestId: SERVER_ID }),
    })
    expect(resolveBuiltInAiRequestId(wrapped, SENT_ID)).toBe(SERVER_ID)
  })

  it.each([
    ["an older server that names none", {}],
    ["a payload without data", undefined],
    ["an id that is not a UUID", { requestId: "req_123" }],
    ["an id that is not a string", { requestId: 42 }],
  ])("falls back to the id the call sent for %s", (_label, data) => {
    expect(resolveBuiltInAiRequestId(orpcError(data), SENT_ID)).toBe(SENT_ID)
  })

  it("has no id when neither side has a valid one", () => {
    expect(resolveBuiltInAiRequestId(orpcError({}), undefined)).toBeUndefined()
    expect(resolveBuiltInAiRequestId(orpcError({}), "not-a-uuid")).toBeUndefined()
    expect(resolveBuiltInAiRequestId("boom", undefined)).toBeUndefined()
  })
})

describe("getBuiltInAiRequestId", () => {
  it("reads the tag the background put on the error", () => {
    const error = Object.assign(new Error("boom"), { [BUILT_IN_AI_REQUEST_ID_FIELD]: SENT_ID })
    expect(getBuiltInAiRequestId(error)).toBe(SENT_ID)
  })

  it("reads it off a failure relayed over the stream port", () => {
    expect(
      getBuiltInAiRequestId(new StreamPortError({ message: "boom", builtInAiRequestId: SENT_ID })),
    ).toBe(SENT_ID)
    expect(getBuiltInAiRequestId(new StreamPortError({ message: "boom" }))).toBeUndefined()
  })

  it("reads it off the error a failure was wrapped in, as subtitles word a batch's", () => {
    const tagged = Object.assign(new Error("Internal server error"), {
      [BUILT_IN_AI_REQUEST_ID_FIELD]: SENT_ID,
    })
    expect(getBuiltInAiRequestId(new Error("Built-in AI: busy", { cause: tagged }))).toBe(SENT_ID)
  })

  it("ignores anything that is not a UUID, and errors no Built-in AI call tagged", () => {
    expect(
      getBuiltInAiRequestId(Object.assign(new Error("x"), { builtInAiRequestId: "<b>hi</b>" })),
    ).toBeUndefined()
    // A provider's own request id is never shown as ours.
    expect(
      getBuiltInAiRequestId(Object.assign(new Error("x"), { requestId: SENT_ID })),
    ).toBeUndefined()
    expect(getBuiltInAiRequestId(undefined)).toBeUndefined()
    expect(getBuiltInAiRequestId(SENT_ID)).toBeUndefined()
  })
})

describe("a tagged error crossing the messaging layer", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("arrives with its request id", async () => {
    // The one-process stand-in for runtime messaging: the library serializes the
    // handler's rejection on one side and rebuilds it on the other, as between the
    // background and a content script.
    let listener:
      | ((message: unknown, sender: unknown, respond: (r: unknown) => void) => unknown)
      | undefined
    vi.stubGlobal("chrome", {
      runtime: {
        lastError: undefined,
        onMessage: {
          addListener: (fn: typeof listener) => {
            listener = fn
          },
          removeListener: () => {},
        },
        sendMessage: (message: unknown, respond: (response: unknown) => void) => {
          listener?.(structuredClone(message), {}, (response) => respond(structuredClone(response)))
        },
      },
    })
    const { onMessage, sendMessage } = defineExtensionMessaging<{ fail: () => string }>()
    onMessage("fail", () => {
      throw Object.assign(new Error("Built-in AI failed"), {
        code: "INTERNAL_SERVER_ERROR",
        [BUILT_IN_AI_REQUEST_ID_FIELD]: SERVER_ID,
      })
    })

    const received = await sendMessage("fail").then(
      () => undefined,
      (error: unknown) => error,
    )

    expect(received).toBeInstanceOf(Error)
    expect((received as Error).message).toBe("Built-in AI failed")
    expect(getBuiltInAiRequestId(received)).toBe(SERVER_ID)
  })
})
