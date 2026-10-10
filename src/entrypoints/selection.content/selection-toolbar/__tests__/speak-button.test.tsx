// @vitest-environment jsdom
import type { SelectionSession } from "../atoms"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
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

vi.mock("@/components/ui/base-ui/toast", () => ({ toastManager: { add: toastAdd } }))

afterEach(() => {
  tts.instances = 0
  tts.isPlaying = true
  tts.play.mockClear()
  tts.stop.mockClear()
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

// Presses Alt+Shift+R on the page and returns the event: claimed when speak ran.
function pressSpeakKey() {
  const event = new KeyboardEvent("keydown", {
    key: "R",
    code: "KeyR",
    altKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  })
  act(() => {
    document.body.dispatchEvent(event)
  })
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

  it("reads a selection made with the keyboard, which the toolbar never recorded", () => {
    tts.isPlaying = false
    const paragraph = document.createElement("p")
    paragraph.textContent = "Selected with Shift and the arrow keys"
    document.body.appendChild(paragraph)
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    window.getSelection()!.addRange(range)
    renderSpeech()

    try {
      const event = pressSpeakKey()

      expect(tts.play).toHaveBeenCalledWith(
        "Selected with Shift and the arrow keys",
        DEFAULT_CONFIG.tts,
        { surface: "shortcut" },
      )
      expect(event.defaultPrevented).toBe(true)
    } finally {
      window.getSelection()!.removeAllRanges()
      paragraph.remove()
    }
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

  it("leaves the key to the page while speak is turned off", async () => {
    const store = createStore()
    const config = structuredClone(DEFAULT_CONFIG)
    config.selectionToolbar.features.speak.enabled = false
    // The config atom reloads from storage once mounted.
    await fakeBrowser.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
    store.set(configAtom, config)
    renderSpeech(store)
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))

    expect(pressSpeakKey().defaultPrevented).toBe(false)
    expect(tts.stop).not.toHaveBeenCalled()
  })
})
