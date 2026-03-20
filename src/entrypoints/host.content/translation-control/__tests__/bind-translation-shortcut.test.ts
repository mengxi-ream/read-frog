import type { PageTranslationManager } from "../page-translation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { bindTranslationShortcutKey } from "../bind-translation-shortcut"

const {
  mockGetLocalConfig,
  mockRegister,
  mockUnregister,
} = vi.hoisted(() => ({
  mockGetLocalConfig: vi.fn(),
  mockRegister: vi.fn(),
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

function createManager(isActive = false): PageTranslationManager {
  return {
    isActive,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  } as unknown as PageTranslationManager
}

describe("bindTranslationShortcutKey", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRegister.mockReturnValue({
      unregister: mockUnregister,
    })
  })

  it("registers the page shortcut with the TanStack manager options", async () => {
    mockGetLocalConfig.mockResolvedValue({
      translate: {
        page: {
          shortcut: "Mod+E",
        },
      },
    })

    const manager = createManager(false)
    const cleanup = await bindTranslationShortcutKey(manager)

    expect(mockRegister).toHaveBeenCalledWith(
      "Mod+E",
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

  it("toggles page translation through the registered callback", async () => {
    mockGetLocalConfig.mockResolvedValue({
      translate: {
        page: {
          shortcut: "Mod+E",
        },
      },
    })

    const inactiveManager = createManager(false)
    await bindTranslationShortcutKey(inactiveManager)
    const startCallback = mockRegister.mock.calls[0]?.[1]
    startCallback?.({} as KeyboardEvent, { hotkey: "Mod+E" })
    expect(inactiveManager.start).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    mockRegister.mockReturnValue({
      unregister: mockUnregister,
    })
    mockGetLocalConfig.mockResolvedValue({
      translate: {
        page: {
          shortcut: "Mod+E",
        },
      },
    })

    const activeManager = createManager(true)
    await bindTranslationShortcutKey(activeManager)
    const stopCallback = mockRegister.mock.calls[0]?.[1]
    stopCallback?.({} as KeyboardEvent, { hotkey: "Mod+E" })
    expect(activeManager.stop).toHaveBeenCalledTimes(1)
  })

  it("skips registration when the shortcut is empty", async () => {
    mockGetLocalConfig.mockResolvedValue({
      translate: {
        page: {
          shortcut: "",
        },
      },
    })

    const cleanup = await bindTranslationShortcutKey(createManager(false))

    expect(mockRegister).not.toHaveBeenCalled()
    cleanup()
    expect(mockUnregister).not.toHaveBeenCalled()
  })
})
