import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest"
import { browser } from "#imports"
import { captureLogs, logRecord } from "@/utils/logging/testing"

const { onMessageMock, sendMessageMock } = vi.hoisted(() => ({
  onMessageMock: vi.fn<(type: string, handler: () => unknown) => void>(),
  sendMessageMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}))

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
  sendMessage: sendMessageMock,
}))

describe("guidePinExtension", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    onMessageMock.mockClear()
  })

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

  // Safari has neither, and puts every enabled extension's button on the
  // toolbar itself. Answering anything else would hold up the website's guide.
  it("answers pinned, without checking or polling, when the browser can't tell", async () => {
    const { getUserSettings, onUserSettingsChanged } = browser.action
    Object.assign(browser.action, { getUserSettings: undefined, onUserSettingsChanged: undefined })
    onTestFinished(() => {
      Object.assign(browser.action, { getUserSettings, onUserSettingsChanged })
    })
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval")
    const tabsQuery = vi.spyOn(browser.tabs, "query")
    const { guidePinExtension } = await import("../new-user-guide")

    await guidePinExtension()

    const getPinState = onMessageMock.mock.calls.find(([type]) => type === "getPinState")?.[1]
    expect(await getPinState?.()).toBe(true)
    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(tabsQuery).not.toHaveBeenCalled()
  })
})
