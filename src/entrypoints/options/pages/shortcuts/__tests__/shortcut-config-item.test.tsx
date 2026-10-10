// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { configAtom } from "@/utils/atoms/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { getActionShortcutId, getShortcutBindings } from "../shortcut-bindings"
import { ShortcutConfigItem } from "../shortcut-config-item"

const toastAdd = vi.hoisted(() => vi.fn<(toast: unknown) => void>())

// Shows the substitutions, so a message can be checked for the shortcut it names.
vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, substitutions?: string[]) =>
      substitutions ? `${key}:${substitutions.join("|")}` : key,
  },
}))

vi.mock("@/components/ui/base-ui/toast", () => ({ toastManager: { add: toastAdd } }))

afterEach(() => {
  toastAdd.mockClear()
  fakeBrowser.reset()
})

async function renderItem(
  config: Config,
  shortcut: string,
  onChange = vi.fn<(shortcut: string) => void>(),
) {
  // The config atom reloads from storage once mounted.
  await fakeBrowser.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
  const store = createStore()
  store.set(configAtom, config)
  render(
    <Provider store={store}>
      <ShortcutConfigItem
        id="selection-speak-shortcut"
        title="Speak"
        description="Reads aloud"
        shortcut={shortcut}
        onChange={onChange}
      />
    </Provider>,
  )
  return onChange
}

function record(keys: { key: string; altKey?: boolean; shiftKey?: boolean; code?: string }) {
  const input = screen.getByPlaceholderText("shortcutKeySelector.placeholder")
  fireEvent.focus(input)
  fireEvent.keyDown(document, keys)
}

describe("shortcut bindings", () => {
  it("lists every page shortcut and every action, built-in or custom", () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.selectionToolbar.customActions = [
      {
        id: "custom-1",
        name: "Mine",
        icon: "tabler:star",
        providerId: "openai-default",
        systemPrompt: "",
        prompt: "",
        outputSchema: [{ id: "f", name: "f", type: "string", description: "" }],
      },
    ]

    const bindings = getShortcutBindings(config)

    expect(bindings.map((binding) => binding.id)).toEqual([
      "page-translation-shortcut",
      "translation-mode-shortcut",
      "selection-translation-shortcut",
      "selection-speak-shortcut",
      "subtitles-toggle-shortcut",
      "translation-hub-shortcut",
      getActionShortcutId("default-dictionary"),
      getActionShortcutId("default-sentence-analysis"),
      getActionShortcutId("default-improve-writing"),
      getActionShortcutId("custom-1"),
    ])
    expect(bindings.at(-1)?.shortcut).toBe("")
  })
})

describe("ShortcutConfigItem", () => {
  it("turns down a key another shortcut has, naming that shortcut", async () => {
    const onChange = await renderItem(structuredClone(DEFAULT_CONFIG), "Alt+Shift+R")

    record({ key: "t", altKey: true, code: "KeyT" })

    await waitFor(() => {
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: expect.stringMatching(
            /^options\.shortcuts\.taken:.+\|options\.shortcuts\.selectionTranslation\.title$/,
          ),
        }),
      )
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("saves a key no other shortcut has", async () => {
    const onChange = await renderItem(structuredClone(DEFAULT_CONFIG), "Alt+Shift+R")

    record({ key: "k", altKey: true, shiftKey: true, code: "KeyK" })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("Alt+Shift+K")
    })
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it("flags a clash saved before the check existed", async () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.selectionToolbar.features.speak.shortcut = "Alt+Shift+D"
    await renderItem(config, "Alt+Shift+D")

    // Named after the built-in Dictionary, whose key it is.
    expect(screen.getByText(/^options\.shortcuts\.clash:/)).toHaveTextContent(
      "options.shortcuts.clash:options.selectionToolbar.customActions.templates.dictionary.name",
    )
  })
})
