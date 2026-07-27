import { beforeEach, describe, expect, it } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { onMessage, sendMessage } from "../message"

describe("extension messaging", () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it("round-trips async responses through the callback-based browser API", async () => {
    const removeListener = onMessage("getInitialConfig", async () => null)

    try {
      await expect(sendMessage("getInitialConfig", undefined)).resolves.toBeNull()
    } finally {
      removeListener()
    }
  })
})
