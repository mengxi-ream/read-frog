// @vitest-environment jsdom
import type { SelectionSession } from "../atoms"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { i18n } from "@/utils/i18n"
import { selectionSessionAtom } from "../atoms"
import { SelectionSpeechProvider, SpeakButton, useSelectionSpeech } from "../speak-button"

const tts = vi.hoisted(() => ({
  instances: 0,
  isPlaying: true,
  play: vi.fn<(text: string, ttsConfig: unknown, options?: { surface?: string }) => void>(),
  stop: vi.fn<(instance: number) => void>(),
}))

const hotkeys = vi.hoisted(() => ({
  register: vi.fn<(...args: any[]) => { unregister: () => void }>(),
}))

const toastAdd = vi.hoisted(() => vi.fn<(toast: unknown) => void>())

// Each mounted reader gets an id of its own, so the test can tell one shared
// reader from one per component.
vi.mock("@/hooks/use-text-to-speech", async () => {
  const { useState } = await import("react")
  return {
    useTextToSpeech: () => {
      const [instance] = useState(() => ++tts.instances)
      return {
        isFetching: false,
        isPlaying: tts.isPlaying,
        play: async (...args: Parameters<typeof tts.play>) => tts.play(...args),
        stop: () => tts.stop(instance),
      }
    },
  }
})

vi.mock("@tanstack/hotkeys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/hotkeys")>()),
  HotkeyManager: { getInstance: () => ({ register: hotkeys.register }) },
}))

vi.mock("@/components/ui/base-ui/toast", () => ({ toastManager: { add: toastAdd } }))

beforeEach(() => {
  hotkeys.register.mockReturnValue({ unregister: vi.fn<() => void>() })
})

afterEach(() => {
  tts.instances = 0
  tts.isPlaying = true
  tts.play.mockClear()
  tts.stop.mockClear()
  hotkeys.register.mockReset()
  toastAdd.mockClear()
  fakeBrowser.reset()
})

function MenuRow() {
  const speech = useSelectionSpeech()
  return (
    <button type="button" data-testid="menu-row" onClick={() => speech.toggle()}>
      {speech.label}
    </button>
  )
}

function renderSpeech(store = createStore()) {
  return render(
    <Provider store={store}>
      <TooltipProvider>
        <SelectionSpeechProvider>
          <SpeakButton />
          <MenuRow />
        </SelectionSpeechProvider>
      </TooltipProvider>
    </Provider>,
  )
}

function selectText(store: ReturnType<typeof createStore>, text: string) {
  const session: SelectionSession = {
    id: 1,
    createdAt: 0,
    selectionSnapshot: { text, ranges: [] },
    contextSnapshot: { text, paragraphs: [] },
  }
  store.set(selectionSessionAtom, session)
}

function pressSpeakKey() {
  const registration = hotkeys.register.mock.calls.findLast((call) => call[0] === "Alt+Shift+R")
  if (!registration) {
    throw new Error("The speak key is not bound")
  }
  const event = new KeyboardEvent("keydown", { cancelable: true })
  ;(registration[1] as (event: KeyboardEvent) => void)(event)
  return event
}

describe("SelectionSpeechProvider", () => {
  it("gives the speak button and the menu one reader, so either shows and stops its playback", () => {
    renderSpeech()

    expect(tts.instances).toBe(1)
    // The button and the row both read as playing.
    expect(screen.getAllByRole("button", { name: i18n.t("action.playing") })).toHaveLength(2)

    fireEvent.click(screen.getByTestId("menu-row"))
    expect(tts.stop).toHaveBeenCalledWith(1)
  })

  it("reads the selection aloud from its key, reported as a shortcut", () => {
    tts.isPlaying = false
    const store = createStore()
    selectText(store, "Hello there")
    renderSpeech(store)

    const event = pressSpeakKey()

    expect(tts.play).toHaveBeenCalledWith("Hello there", DEFAULT_CONFIG.tts, {
      surface: "shortcut",
    })
    expect(event.defaultPrevented).toBe(true)
  })

  it("stops the reading in progress from its key", () => {
    renderSpeech()

    const event = pressSpeakKey()

    expect(tts.stop).toHaveBeenCalledWith(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it("leaves the key to the page when there is nothing to read", () => {
    tts.isPlaying = false
    renderSpeech()

    const event = pressSpeakKey()

    expect(tts.play).not.toHaveBeenCalled()
    expect(toastAdd).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it("binds no key while speak is turned off", async () => {
    const store = createStore()
    const config = structuredClone(DEFAULT_CONFIG)
    config.selectionToolbar.features.speak.enabled = false
    // The config atom reloads from storage once mounted.
    await fakeBrowser.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
    store.set(configAtom, config)
    renderSpeech(store)
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))

    expect(hotkeys.register.mock.calls.map((call) => call[0])).not.toContain("Alt+Shift+R")
  })
})
