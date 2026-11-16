// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { i18n } from "@/utils/i18n"
import { isSelectionToolbarHiddenUntilReloadAtom } from "../atoms"
import { CloseButton } from "../close-button"

// The menu portals into the content UI's shadow wrapper, which exists only once mounted.
vi.mock("../../main", () => ({
  shadowWrapper: document.body,
}))

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn<(...args: any[]) => any>(async () => undefined),
}))

vi.mock("@/utils/message", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/message")>()),
  sendMessage: sendMessageMock,
}))

afterEach(() => {
  cleanup()
  fakeBrowser.reset()
})

// The stored config too: the config atom reloads it once mounted.
async function renderCloseButton(edit?: (config: Config) => void) {
  const store = createStore()
  const config = structuredClone(DEFAULT_CONFIG)
  edit?.(config)
  await fakeBrowser.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
  store.set(configAtom, config)
  render(
    <Provider store={store}>
      <CloseButton />
    </Provider>,
  )
  return store
}

async function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Close selection toolbar" }))
  await waitFor(() => expect(screen.getByText(i18n.t("hideMenu.untilReload"))).toBeInTheDocument())
}

async function choose(key: Parameters<typeof i18n.t>[0]) {
  await openMenu()
  fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(key) }))
}

describe("selection toolbar close menu", () => {
  it("names what it hides and where to turn it back on", async () => {
    await renderCloseButton()
    await openMenu()

    expect(screen.getByText(i18n.t("options.selectionToolbar.closeMenu.title"))).toBeInTheDocument()
    expect(screen.getAllByRole("menuitem")).toHaveLength(3)
    expect(screen.getByText(/^hideMenu\.restoreHint/)).toHaveTextContent(
      "popup.options → options.selectionToolbar.title",
    )
    // The site choice carries the host it would add.
    expect(screen.getByRole("menuitem", { name: /hideMenu\.onSite/ })).toHaveAttribute(
      "title",
      window.location.hostname,
    )
  })

  it("hides the toolbar until reload without changing a setting", async () => {
    const store = await renderCloseButton()
    const before = store.get(configFieldsAtomMap.selectionToolbar)

    await choose("hideMenu.untilReload")

    expect(store.get(isSelectionToolbarHiddenUntilReloadAtom)).toBe(true)
    // So the toolbars in the page's other frames hide too.
    expect(sendMessageMock).toHaveBeenCalledWith("hideSelectionToolbarUntilReload", undefined)
    expect(store.get(configFieldsAtomMap.selectionToolbar)).toEqual(before)
  })

  it("adds this site the way the popup's per-site switches do, once", async () => {
    const host = window.location.hostname
    const store = await renderCloseButton((config) => {
      config.selectionToolbar.disabledSelectionToolbarPatterns = ["github.com"]
    })

    await choose("hideMenu.onSite")

    await waitFor(() =>
      expect(
        store.get(configFieldsAtomMap.selectionToolbar).disabledSelectionToolbarPatterns,
      ).toEqual(["github.com", `*.${host}`]),
    )
    expect(store.get(isSelectionToolbarHiddenUntilReloadAtom)).toBe(false)

    await choose("hideMenu.onSite")
    await waitFor(() =>
      expect(
        store.get(configFieldsAtomMap.selectionToolbar).disabledSelectionToolbarPatterns,
      ).toEqual(["github.com", `*.${host}`]),
    )
  })

  it("turns the toolbar off on all sites", async () => {
    const store = await renderCloseButton()

    await choose("hideMenu.onAllSites")

    await waitFor(() => expect(store.get(configFieldsAtomMap.selectionToolbar).enabled).toBe(false))
  })
})
