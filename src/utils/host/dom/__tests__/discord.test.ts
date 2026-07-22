// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { PARAGRAPH_ATTRIBUTE, WALKED_ATTRIBUTE } from "@/utils/constants/dom-labels"
import { unwrapDeepestOnlyHTMLChild } from "../find"
import { extractTextContent, walkAndLabelElement } from "../traversal"

function setDiscordUrl() {
  Object.defineProperty(window, "location", {
    value: new URL("https://discord.com/channels/1371229720942874646/1529001476482011136"),
    writable: true,
  })
}

describe("Discord translation rules", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("keeps edited-message metadata out of the translation unit (issue #1927)", () => {
    setDiscordUrl()
    document.body.innerHTML = `
      <li id="chat-messages-1529001476482011136-1529199071137370203">
        <div id="message-content-1529199071137370203" class="markup__75297 messageContent_c19a55">
          <span id="message-body">Read Frog edited-message DOM test</span>
          <span id="edited-metadata" class="timestamp_c19a55">
            <span>
              <time datetime="2026-07-21T18:51:53.357Z">
                <span class="edited_c19a55">(edited)</span>
              </time>
            </span>
            <span class="hiddenVisually_b18fe2">Tuesday, July 21, 2026 at 11:51 AM</span>
          </span>
        </div>
      </li>
    `

    const config = structuredClone(DEFAULT_CONFIG)
    const messageContent = document.querySelector<HTMLElement>("[id^='message-content']")!
    const messageBody = document.querySelector<HTMLElement>("#message-body")!
    const editedMetadata = document.querySelector<HTMLElement>("#edited-metadata")!

    walkAndLabelElement(document.body, "discord-edited-message", config)

    expect(messageContent.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    expect(editedMetadata.hasAttribute(WALKED_ATTRIBUTE)).toBe(false)
    expect(extractTextContent(messageContent, config).trim()).toBe(messageBody.textContent)
    expect(unwrapDeepestOnlyHTMLChild(messageContent, config)).toBe(messageBody)
  })
})
