// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { getBuiltInDictionaryAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { DropEvent } from "../close-button"
import { SelectionToolbarMoreMenu } from "../more-menu"

const mocks = vi.hoisted(() => ({
  openToolbarTranslation: vi.fn<(anchor: HTMLElement | null) => void>(),
  openToolbarCustomAction: vi.fn<(actionId: string, anchor: HTMLElement | null) => void>(),
  toggleSpeech: vi.fn<() => boolean>(() => true),
}))

vi.mock("../translate-button/provider", () => ({
  useSelectionTranslationPopover: () => ({ openToolbarTranslation: mocks.openToolbarTranslation }),
}))

vi.mock("../custom-action-button/provider", () => ({
  useSelectionCustomActionPopover: () => ({
    openToolbarCustomAction: mocks.openToolbarCustomAction,
  }),
}))

vi.mock("../speak-button", () => ({
  useSelectionSpeech: () => ({
    isFetching: false,
    isPlaying: false,
    label: "Speak",
    toggle: mocks.toggleSpeech,
  }),
}))

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  fakeBrowser.reset()
})

// The stored config too: the config atom reloads it once mounted.
async function renderMenu(edit?: (config: Config) => void) {
  const store = createStore()
  const config = structuredClone(DEFAULT_CONFIG)
  edit?.(config)
  await fakeBrowser.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
  store.set(configAtom, config)
  render(
    <Provider store={store}>
      <TooltipProvider>
        <SelectionToolbarMoreMenu />
      </TooltipProvider>
    </Provider>,
  )
  return store
}

const trigger = () => screen.getByRole("button", { name: i18n.t("action.moreActions") })

async function openMenu() {
  fireEvent.click(trigger())
  await waitFor(() => expect(document.querySelector("[data-item-id]")).not.toBeNull())
}

const itemIds = () =>
  [...document.querySelectorAll<HTMLElement>("[data-item-id]")].map((row) => row.dataset.itemId)

const row = (id: string) => document.querySelector<HTMLElement>(`[data-item-id="${id}"]`)!

const pinButton = (id: string) =>
  within(row(id)).getByRole("button", {
    name: new RegExp(`${i18n.t("action.pinToToolbar")}|${i18n.t("action.unpinFromToolbar")}`),
  })

describe("SelectionToolbarMoreMenu", () => {
  it("lists every enabled item in the toolbar's order, pinned or not", async () => {
    await renderMenu((config) => {
      const dictionary = getBuiltInDictionaryAction(config.selectionToolbar)
      config.selectionToolbar.customActions = [
        { ...dictionary, id: "mine", name: "Mine" },
        { ...dictionary, id: "off", name: "Off", enabled: false },
      ]
      config.selectionToolbar.order = ["mine", "speak", "off", "translate"]
      config.selectionToolbar.unpinned = ["mine", "off"]
    })
    await openMenu()

    // A disabled item is nowhere, pinned or not.
    expect(itemIds()).toEqual([
      "mine",
      "speak",
      "translate",
      "default-dictionary",
      "default-sentence-analysis",
      "default-improve-writing",
    ])
    expect(within(row("mine")).getByText("Mine")).toBeInTheDocument()
    expect(within(row("translate")).getByText(i18n.t("action.translation"))).toBeInTheDocument()
    expect(pinButton("mine")).toHaveAccessibleName(i18n.t("action.pinToToolbar"))
    expect(pinButton("translate")).toHaveAccessibleName(i18n.t("action.unpinFromToolbar"))
  })

  it("pins and unpins an item without touching its enabled switch", async () => {
    const store = await renderMenu((config) => {
      config.selectionToolbar.unpinned = ["default-sentence-analysis"]
    })
    await openMenu()

    fireEvent.click(pinButton("translate"))
    fireEvent.click(pinButton("default-sentence-analysis"))

    await waitFor(() => {
      expect(store.get(configFieldsAtomMap.selectionToolbar).unpinned).toEqual(["translate"])
    })
    const selectionToolbar = store.get(configFieldsAtomMap.selectionToolbar)
    expect(selectionToolbar.features.translate.enabled).toBe(true)
    expect(selectionToolbar.builtInActions.sentenceAnalysis.enabled).toBe(true)
    expect(pinButton("translate")).toHaveAccessibleName(i18n.t("action.pinToToolbar"))
    expect(pinButton("default-sentence-analysis")).toHaveAccessibleName(
      i18n.t("action.unpinFromToolbar"),
    )
  })

  it("runs an item from its row, anchored at the menu's button, and closes", async () => {
    const dropdownStates: boolean[] = []
    const onDropdown = (event: Event) =>
      dropdownStates.push(Boolean((event as CustomEvent).detail?.open))
    window.addEventListener(DropEvent, onDropdown)
    await renderMenu()

    await openMenu()
    const dictionary = getBuiltInDictionaryAction(DEFAULT_CONFIG.selectionToolbar)
    fireEvent.click(within(row("default-dictionary")).getByText(dictionary.name))
    expect(mocks.openToolbarCustomAction).toHaveBeenCalledWith("default-dictionary", trigger())

    await openMenu()
    fireEvent.click(within(row("translate")).getByText(i18n.t("action.translation")))
    expect(mocks.openToolbarTranslation).toHaveBeenCalledWith(trigger())

    await openMenu()
    fireEvent.click(within(row("speak")).getByText("Speak"))
    expect(mocks.toggleSpeech).toHaveBeenCalledOnce()

    // Open and closed each time, so the toolbar stays up only while it is open.
    expect(dropdownStates).toEqual([true, false, true, false, true, false])
    window.removeEventListener(DropEvent, onDropdown)
  })
})
