import { createStore } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  hideSelectionToolbarUntilReloadAtom,
  isSelectionToolbarHiddenUntilReloadAtom,
} from "../atoms"

const { onMessageMock, sendMessageMock, removeListenerMock } = vi.hoisted(() => ({
  onMessageMock: vi.fn<(...args: any[]) => any>(),
  sendMessageMock: vi.fn<(...args: any[]) => any>(),
  removeListenerMock: vi.fn<() => void>(),
}))

vi.mock("@/utils/message", () => ({ onMessage: onMessageMock, sendMessage: sendMessageMock }))

function mount() {
  const store = createStore()
  const unsubscribe = store.sub(isSelectionToolbarHiddenUntilReloadAtom, () => {})
  return { store, unsubscribe }
}

function broadcastHide() {
  const [type, listener] = onMessageMock.mock.calls.at(-1)!
  expect(type).toBe("selectionToolbarHiddenUntilReload")
  listener()
}

describe("selection toolbar hidden until reload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onMessageMock.mockReturnValue(removeListenerMock)
    sendMessageMock.mockResolvedValue(false)
  })

  it("starts hidden when another frame of the tab already hid it", async () => {
    sendMessageMock.mockResolvedValue(true)
    const { store } = mount()

    expect(sendMessageMock).toHaveBeenCalledWith("isSelectionToolbarHiddenUntilReload", undefined)
    await vi.waitFor(() => expect(store.get(isSelectionToolbarHiddenUntilReloadAtom)).toBe(true))
  })

  it("shows when the tab has not hidden it, or the background cannot say", async () => {
    const { store } = mount()
    await Promise.resolve()
    expect(store.get(isSelectionToolbarHiddenUntilReloadAtom)).toBe(false)

    sendMessageMock.mockRejectedValue(new Error("Extension context invalidated"))
    const { store: secondStore } = mount()
    await Promise.resolve()
    expect(secondStore.get(isSelectionToolbarHiddenUntilReloadAtom)).toBe(false)
  })

  it("follows a hide from another frame and stops listening once unused", async () => {
    const { store, unsubscribe } = mount()

    broadcastHide()
    expect(store.get(isSelectionToolbarHiddenUntilReloadAtom)).toBe(true)

    unsubscribe()
    expect(removeListenerMock).toHaveBeenCalledOnce()
  })

  it("hides here at once and asks the background to hide it in the other frames", () => {
    const store = createStore()
    sendMessageMock.mockRejectedValue(new Error("Could not establish connection"))

    store.set(hideSelectionToolbarUntilReloadAtom)

    expect(store.get(isSelectionToolbarHiddenUntilReloadAtom)).toBe(true)
    expect(sendMessageMock).toHaveBeenCalledWith("hideSelectionToolbarUntilReload", undefined)
  })
})
