import { describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { captureLogs, logRecord } from "@/utils/logging/testing"

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}))

vi.mock("@/utils/message", () => ({
  onMessage: () => {},
  sendMessage: sendMessageMock,
}))

describe("guidePinExtension", () => {
  // Every service worker start tells the site's tabs again, and a tab with no
  // content script (after an update, or discarded) has no receiver.
  it("keeps a site tab with no receiver out of the local log", async () => {
    // The test browser has none of these. A spy takes the callback overload's type,
    // so an implementation stands in for mockResolvedValue.
    vi.spyOn(browser.action, "getUserSettings").mockImplementation(async () => ({
      isOnToolbar: true,
    }))
    vi.spyOn(browser.action.onUserSettingsChanged, "addListener").mockImplementation(() => {})
    vi.spyOn(browser.tabs, "query").mockImplementation(((
      _query: unknown,
      callback: (tabs: { id: number }[]) => void,
    ) => callback([{ id: 3 }])) as unknown as typeof browser.tabs.query)
    sendMessageMock.mockRejectedValue(
      new Error("Could not establish connection. Receiving end does not exist."),
    )
    const logs = captureLogs("debug")
    const { guidePinExtension } = await import("../new-user-guide")

    await guidePinExtension()

    await vi.waitFor(() =>
      expect(logs).toEqual([
        logRecord("debug", "Failed to notify pin state", { error: expect.anything() }),
      ]),
    )
    expect(sendMessageMock).toHaveBeenCalledExactlyOnceWith(
      "pinStateChanged",
      { isPinned: true },
      3,
    )
  })
})
