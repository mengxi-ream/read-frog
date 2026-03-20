import { describe, expect, it, vi } from "vitest"
import { setupOptionalContextMenu } from "@/entrypoints/background"

describe("setupOptionalContextMenu", () => {
  it("skips context menu setup when the target does not support it", () => {
    const registerContextMenuListeners = vi.fn()
    const initializeContextMenu = vi.fn()

    setupOptionalContextMenu({
      initializeContextMenu,
      registerContextMenuListeners,
      supportsContextMenu: false,
    })

    expect(registerContextMenuListeners).not.toHaveBeenCalled()
    expect(initializeContextMenu).not.toHaveBeenCalled()
  })

  it("registers and initializes context menus when supported", () => {
    const registerContextMenuListeners = vi.fn()
    const initializeContextMenu = vi.fn()

    setupOptionalContextMenu({
      initializeContextMenu,
      registerContextMenuListeners,
      supportsContextMenu: true,
    })

    expect(registerContextMenuListeners).toHaveBeenCalledOnce()
    expect(initializeContextMenu).toHaveBeenCalledOnce()
  })
})
