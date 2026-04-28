import { beforeEach, describe, expect, it, vi } from "vitest"
import { bindSplitTranslatorShortcutKey } from "../bind-split-translator-shortcut"

const {
  mockGetLocalConfig,
  mockRegister,
  mockSendMessage,
  mockUnregister,
} = vi.hoisted(() => ({
  mockGetLocalConfig: vi.fn(),
  mockRegister: vi.fn(),
  mockSendMessage: vi.fn(),
  mockUnregister: vi.fn(),
}))

vi.mock("@tanstack/hotkeys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/hotkeys")>()

  return {
    ...actual,
    HotkeyManager: {
      getInstance: () => ({
        register: mockRegister,
      }),
    },
  }
})

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mockGetLocalConfig,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}))

describe("bindSplitTranslatorShortcutKey", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRegister.mockReturnValue({
      unregister: mockUnregister,
    })
    mockSendMessage.mockResolvedValue({ ok: true, action: "opened" })
  })

  it("registers the split translator shortcut with the TanStack manager options", async () => {
    mockGetLocalConfig.mockResolvedValue({
      translate: {
        splitTranslator: {
          shortcut: "Alt+S",
        },
      },
    })

    const cleanup = await bindSplitTranslatorShortcutKey()

    expect(mockRegister).toHaveBeenCalledWith(
      "Alt+S",
      expect.any(Function),
      expect.objectContaining({
        ignoreInputs: true,
        preventDefault: true,
        stopPropagation: true,
      }),
    )

    cleanup()
    expect(mockUnregister).toHaveBeenCalled()
  })

  it("toggles the side panel through the registered callback", async () => {
    mockGetLocalConfig.mockResolvedValue({
      translate: {
        splitTranslator: {
          shortcut: "Alt+S",
        },
      },
    })

    await bindSplitTranslatorShortcutKey()
    const callback = mockRegister.mock.calls[0]?.[1]
    callback?.({} as KeyboardEvent, { hotkey: "Alt+S" })

    expect(mockSendMessage).toHaveBeenCalledWith("toggleSidePanel", undefined)
  })

  it("skips registration when the split translator shortcut is empty", async () => {
    mockGetLocalConfig.mockResolvedValue({
      translate: {
        splitTranslator: {
          shortcut: "",
        },
      },
    })

    const cleanup = await bindSplitTranslatorShortcutKey()

    expect(mockRegister).not.toHaveBeenCalled()
    cleanup()
    expect(mockUnregister).not.toHaveBeenCalled()
  })

  it("skips registration when the split translator shortcut is invalid", async () => {
    mockGetLocalConfig.mockResolvedValue({
      translate: {
        splitTranslator: {
          shortcut: "S",
        },
      },
    })

    await bindSplitTranslatorShortcutKey()

    expect(mockRegister).not.toHaveBeenCalled()
  })
})
