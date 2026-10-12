import type {
  EbookBridgeExtensionHandshake,
  EbookBridgeSelectionPayload,
} from "@read-frog/definitions"
import {
  EBOOK_BRIDGE_EXTENSION_SOURCE,
  EBOOK_BRIDGE_HANDSHAKE_TYPE,
  EBOOK_BRIDGE_SELECTION_CHANGED_TYPE,
  EBOOK_BRIDGE_SELECTION_CLEARED_TYPE,
  EBOOK_SELECTION_BRIDGE_PROTOCOL_VERSION,
  ebookBridgePageMessageSchema,
} from "@read-frog/definitions"
import { browser } from "#imports"
import { env } from "@/env"
import {
  EXTERNAL_SELECTION_CLEAR_EVENT,
  EXTERNAL_SELECTION_OPEN_EVENT,
} from "@/utils/constants/selection"

function replyToHandshake() {
  const reply: EbookBridgeExtensionHandshake = {
    source: EBOOK_BRIDGE_EXTENSION_SOURCE,
    type: EBOOK_BRIDGE_HANDSHAKE_TYPE,
    protocolVersion: EBOOK_SELECTION_BRIDGE_PROTOCOL_VERSION,
    data: {
      extensionVersion: browser.runtime.getManifest().version,
    },
  }

  window.postMessage(reply, window.location.origin)
}

/**
 * Consumes ebook selection-bridge messages relayed by the readfrog.app reader
 * page (the reader detects selections inside the book iframe, which this
 * top-frame content script cannot observe) and re-emits them as window
 * CustomEvents for the selection toolbar.
 */
export function setupExternalSelectionSource(): (() => void) | null {
  if (!env.WXT_OFFICIAL_SITE_ORIGINS.includes(window.location.origin)) {
    return null
  }

  if (window.top !== window) {
    return null
  }

  const handleMessage = (e: MessageEvent) => {
    if (e.source !== window) {
      return
    }

    const parsed = ebookBridgePageMessageSchema.safeParse(e.data)
    // Silently ignore unrelated postMessage traffic and unknown message types
    // (the protocol requires receivers to ignore, not throw on, unknown input)
    if (!parsed.success) {
      return
    }

    switch (parsed.data.type) {
      case EBOOK_BRIDGE_HANDSHAKE_TYPE:
        replyToHandshake()
        break
      case EBOOK_BRIDGE_SELECTION_CHANGED_TYPE:
        window.dispatchEvent(
          new CustomEvent<EbookBridgeSelectionPayload>(EXTERNAL_SELECTION_OPEN_EVENT, {
            detail: parsed.data.data,
          }),
        )
        break
      case EBOOK_BRIDGE_SELECTION_CLEARED_TYPE:
        window.dispatchEvent(new CustomEvent(EXTERNAL_SELECTION_CLEAR_EVENT))
        break
      default:
        break
    }
  }

  window.addEventListener("message", handleMessage)

  return () => {
    window.removeEventListener("message", handleMessage)
  }
}
