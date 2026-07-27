// @vitest-environment jsdom
import type { EbookBridgeSelectionPayload } from "@read-frog/definitions"
import {
  EBOOK_BRIDGE_EXTENSION_SOURCE,
  EBOOK_BRIDGE_HANDSHAKE_TYPE,
  EBOOK_BRIDGE_PAGE_SOURCE,
  EBOOK_BRIDGE_SELECTION_CHANGED_TYPE,
  EBOOK_BRIDGE_SELECTION_CLEARED_TYPE,
  EBOOK_SELECTION_BRIDGE_PROTOCOL_VERSION,
} from "@read-frog/definitions"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  EXTERNAL_SELECTION_CLEAR_EVENT,
  EXTERNAL_SELECTION_OPEN_EVENT,
} from "@/utils/constants/selection"
import { setupExternalSelectionSource } from "../external-selection-source"

const mockOfficialOrigins = vi.hoisted(() => ({ value: [] as string[] }))

vi.mock("@/env", () => ({
  env: {
    get WXT_OFFICIAL_SITE_ORIGINS() {
      return mockOfficialOrigins.value
    },
  },
}))

const SELECTION_PAYLOAD: EbookBridgeSelectionPayload = {
  requestId: "req-1",
  text: "Selected ebook text",
  contextParagraphs: ["Paragraph one", "Paragraph two"],
  rect: { top: 120, left: 40, width: 200, height: 18 },
  anchor: { x: 240, y: 138 },
  direction: "bottom-right",
  bookTitle: "Some Book",
}

const HANDSHAKE_MESSAGE = {
  source: EBOOK_BRIDGE_PAGE_SOURCE,
  protocolVersion: EBOOK_SELECTION_BRIDGE_PROTOCOL_VERSION,
  type: EBOOK_BRIDGE_HANDSHAKE_TYPE,
}

const SELECTION_CHANGED_MESSAGE = {
  source: EBOOK_BRIDGE_PAGE_SOURCE,
  protocolVersion: EBOOK_SELECTION_BRIDGE_PROTOCOL_VERSION,
  type: EBOOK_BRIDGE_SELECTION_CHANGED_TYPE,
  data: SELECTION_PAYLOAD,
}

const SELECTION_CLEARED_MESSAGE = {
  source: EBOOK_BRIDGE_PAGE_SOURCE,
  protocolVersion: EBOOK_SELECTION_BRIDGE_PROTOCOL_VERSION,
  type: EBOOK_BRIDGE_SELECTION_CLEARED_TYPE,
}

function dispatchPageMessage(data: unknown, source: MessageEventSource | null = window) {
  window.dispatchEvent(new MessageEvent("message", { data, source }))
}

describe("setupExternalSelectionSource", () => {
  let teardown: (() => void) | null = null

  beforeEach(() => {
    mockOfficialOrigins.value = [window.location.origin]
  })

  afterEach(() => {
    teardown?.()
    teardown = null
    vi.restoreAllMocks()
  })

  it("returns null when the origin is not an official site origin", () => {
    mockOfficialOrigins.value = ["https://readfrog.app"]
    const postMessageSpy = vi.spyOn(window, "postMessage")

    teardown = setupExternalSelectionSource()

    expect(teardown).toBeNull()

    dispatchPageMessage(HANDSHAKE_MESSAGE)
    expect(postMessageSpy).not.toHaveBeenCalled()
  })

  it("registers on an official origin and replies to the page handshake", () => {
    teardown = setupExternalSelectionSource()
    expect(teardown).not.toBeNull()

    const postMessageSpy = vi.spyOn(window, "postMessage")
    dispatchPageMessage(HANDSHAKE_MESSAGE)

    expect(postMessageSpy).toHaveBeenCalledTimes(1)
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        source: EBOOK_BRIDGE_EXTENSION_SOURCE,
        type: EBOOK_BRIDGE_HANDSHAKE_TYPE,
        protocolVersion: EBOOK_SELECTION_BRIDGE_PROTOCOL_VERSION,
        data: { extensionVersion: "1.0.0" },
      },
      window.location.origin,
    )
  })

  it("ignores messages whose source is not this window", () => {
    teardown = setupExternalSelectionSource()

    const openListener = vi.fn<(event: Event) => void>()
    window.addEventListener(EXTERNAL_SELECTION_OPEN_EVENT, openListener)
    const postMessageSpy = vi.spyOn(window, "postMessage")

    dispatchPageMessage(HANDSHAKE_MESSAGE, null)
    dispatchPageMessage(SELECTION_CHANGED_MESSAGE, null)

    expect(postMessageSpy).not.toHaveBeenCalled()
    expect(openListener).not.toHaveBeenCalled()

    window.removeEventListener(EXTERNAL_SELECTION_OPEN_EVENT, openListener)
  })

  it("silently ignores schema-invalid payloads", () => {
    teardown = setupExternalSelectionSource()

    const openListener = vi.fn<(event: Event) => void>()
    const clearListener = vi.fn<(event: Event) => void>()
    window.addEventListener(EXTERNAL_SELECTION_OPEN_EVENT, openListener)
    window.addEventListener(EXTERNAL_SELECTION_CLEAR_EVENT, clearListener)
    const postMessageSpy = vi.spyOn(window, "postMessage")

    dispatchPageMessage("junk")
    dispatchPageMessage({ source: EBOOK_BRIDGE_PAGE_SOURCE })
    dispatchPageMessage({
      source: EBOOK_BRIDGE_PAGE_SOURCE,
      protocolVersion: EBOOK_SELECTION_BRIDGE_PROTOCOL_VERSION,
      type: "unknownFutureType",
    })
    dispatchPageMessage({
      source: EBOOK_BRIDGE_PAGE_SOURCE,
      protocolVersion: EBOOK_SELECTION_BRIDGE_PROTOCOL_VERSION,
      type: EBOOK_BRIDGE_SELECTION_CHANGED_TYPE,
    })

    expect(postMessageSpy).not.toHaveBeenCalled()
    expect(openListener).not.toHaveBeenCalled()
    expect(clearListener).not.toHaveBeenCalled()

    window.removeEventListener(EXTERNAL_SELECTION_OPEN_EVENT, openListener)
    window.removeEventListener(EXTERNAL_SELECTION_CLEAR_EVENT, clearListener)
  })

  it("dispatches the external open event with the selection payload", () => {
    teardown = setupExternalSelectionSource()

    const openListener = vi.fn<(event: Event) => void>()
    window.addEventListener(EXTERNAL_SELECTION_OPEN_EVENT, openListener)

    dispatchPageMessage(SELECTION_CHANGED_MESSAGE)

    expect(openListener).toHaveBeenCalledTimes(1)
    const event = openListener.mock.calls[0]![0] as CustomEvent<EbookBridgeSelectionPayload>
    expect(event.detail).toEqual(SELECTION_PAYLOAD)

    window.removeEventListener(EXTERNAL_SELECTION_OPEN_EVENT, openListener)
  })

  it("dispatches the external clear event when the selection is cleared", () => {
    teardown = setupExternalSelectionSource()

    const clearListener = vi.fn<(event: Event) => void>()
    window.addEventListener(EXTERNAL_SELECTION_CLEAR_EVENT, clearListener)

    dispatchPageMessage(SELECTION_CLEARED_MESSAGE)

    expect(clearListener).toHaveBeenCalledTimes(1)

    window.removeEventListener(EXTERNAL_SELECTION_CLEAR_EVENT, clearListener)
  })

  it("stops handling messages after cleanup", () => {
    teardown = setupExternalSelectionSource()
    const postMessageSpy = vi.spyOn(window, "postMessage")

    teardown?.()
    teardown = null

    dispatchPageMessage(HANDSHAKE_MESSAGE)
    expect(postMessageSpy).not.toHaveBeenCalled()
  })
})
