import type { Config } from "@/types/config/config"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  FIREFOX_SIDEBAR_COMMAND_NAME,
  getFirefoxSidebarCommandShortcut,
  normalizeFirefoxCommandShortcut,
  setupFirefoxSidebarShortcutSync,
  updateFirefoxSidebarCommandShortcut,
} from "../sidebar-shortcut"

function createConfig({
  shortcut = "Alt+C",
  splitPanelMode = "sideAPI",
}: {
  shortcut?: string
  splitPanelMode?: "dom" | "sideAPI"
} = {}): Config {
  return {
    ...DEFAULT_CONFIG,
    translate: {
      ...DEFAULT_CONFIG.translate,
      page: {
        ...DEFAULT_CONFIG.translate.page,
        sidePanelShortcut: shortcut,
        splitPanelMode,
      },
    },
  }
}

describe("firefox sidebar shortcut sync", () => {
  it("converts configured shortcuts to WebExtensions command shortcut syntax", () => {
    expect(normalizeFirefoxCommandShortcut("Alt+z")).toBe("Alt+Z")
    expect(normalizeFirefoxCommandShortcut("Control+Shift+y")).toBe("Ctrl+Shift+Y")
    expect(normalizeFirefoxCommandShortcut("")).toBe("")
  })

  it("clears the native sidebar shortcut when DOM split mode is configured", () => {
    expect(getFirefoxSidebarCommandShortcut(createConfig({ splitPanelMode: "dom" }))).toBe("")
  })

  it("uses the configured native sidebar shortcut when side API mode is configured", () => {
    expect(getFirefoxSidebarCommandShortcut(createConfig({ shortcut: "Alt+Z" }))).toBe("Alt+Z")
  })

  it("does nothing outside Firefox", async () => {
    const update = vi.fn()
    const storage = {
      getItem: vi.fn().mockResolvedValue(createConfig({ shortcut: "Alt+Z" })),
      watch: vi.fn(),
    }

    setupFirefoxSidebarShortcutSync({
      extensionBrowser: { commands: { update } },
      extensionStorage: storage,
      isFirefox: false,
      logger: { warn: vi.fn() },
    })

    await Promise.resolve()

    expect(storage.getItem).not.toHaveBeenCalled()
    expect(storage.watch).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("syncs the initial config and later config changes to the Firefox sidebar command", async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    let watcher: ((config: Config | null) => void) | undefined
    const storage = {
      getItem: vi.fn().mockResolvedValue(createConfig({ shortcut: "Alt+Z" })),
      watch: vi.fn((_key: string, callback: (config: Config | null) => void) => {
        watcher = callback
      }),
    }

    setupFirefoxSidebarShortcutSync({
      extensionBrowser: { commands: { update } },
      extensionStorage: storage,
      isFirefox: true,
      logger: { warn: vi.fn() },
    })

    await vi.waitFor(() => {
      expect(update).toHaveBeenCalledWith({
        name: FIREFOX_SIDEBAR_COMMAND_NAME,
        shortcut: "Alt+Z",
      })
    })

    watcher?.(createConfig({ shortcut: "Alt+X" }))

    await vi.waitFor(() => {
      expect(update).toHaveBeenLastCalledWith({
        name: FIREFOX_SIDEBAR_COMMAND_NAME,
        shortcut: "Alt+X",
      })
    })
  })

  it("soft fails when Firefox refuses command shortcut updates", async () => {
    const error = new DOMException(
      "A mutation operation was attempted on a database that did not allow mutations.",
      "InvalidStateError",
    )
    const logger = { warn: vi.fn() }

    await expect(updateFirefoxSidebarCommandShortcut({
      commandShortcut: "Alt+Z",
      extensionBrowser: {
        commands: {
          update: vi.fn().mockRejectedValue(error),
        },
      },
      logger,
    })).resolves.toBeUndefined()

    expect(logger.warn).toHaveBeenCalledWith("Failed to update Firefox sidebar shortcut", error)
  })

  it("soft fails when the Firefox commands API is unavailable in private mode", async () => {
    const error = new DOMException(
      "A mutation operation was attempted on a database that did not allow mutations.",
      "InvalidStateError",
    )
    const logger = { warn: vi.fn() }
    const extensionBrowser = Object.defineProperty({}, "commands", {
      get() {
        throw error
      },
    })

    await expect(updateFirefoxSidebarCommandShortcut({
      commandShortcut: "Alt+Z",
      extensionBrowser,
      logger,
    })).resolves.toBeUndefined()

    expect(logger.warn).toHaveBeenCalledWith("Failed to update Firefox sidebar shortcut", error)
  })

  it("soft fails when the config watcher cannot be registered", () => {
    const error = new DOMException(
      "A mutation operation was attempted on a database that did not allow mutations.",
      "InvalidStateError",
    )
    const logger = { warn: vi.fn() }

    expect(() => setupFirefoxSidebarShortcutSync({
      extensionBrowser: { commands: { update: vi.fn() } },
      extensionStorage: {
        getItem: vi.fn().mockResolvedValue(createConfig({ shortcut: "Alt+Z" })),
        watch: vi.fn(() => {
          throw error
        }),
      },
      isFirefox: true,
      logger,
    })).not.toThrow()

    expect(logger.warn).toHaveBeenCalledWith("Failed to watch config for Firefox sidebar shortcut sync", error)
  })
})
