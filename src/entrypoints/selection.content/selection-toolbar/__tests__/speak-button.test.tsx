// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { i18n } from "@/utils/i18n"
import { SelectionSpeechProvider, SpeakButton, useSelectionSpeech } from "../speak-button"

const tts = vi.hoisted(() => ({
  instances: 0,
  stop: vi.fn<(instance: number) => void>(),
}))

// Each mounted reader gets an id of its own, so the test can tell one shared
// reader from one per component.
vi.mock("@/hooks/use-text-to-speech", async () => {
  const { useState } = await import("react")
  return {
    useTextToSpeech: () => {
      const [instance] = useState(() => ++tts.instances)
      return {
        isFetching: false,
        isPlaying: true,
        play: vi.fn<() => Promise<void>>(async () => {}),
        stop: () => tts.stop(instance),
      }
    },
  }
})

afterEach(() => {
  tts.instances = 0
  tts.stop.mockClear()
})

function MenuRow() {
  const speech = useSelectionSpeech()
  return (
    <button type="button" data-testid="menu-row" onClick={() => speech.toggle()}>
      {speech.label}
    </button>
  )
}

describe("SelectionSpeechProvider", () => {
  it("gives the speak button and the menu one reader, so either shows and stops its playback", () => {
    render(
      <Provider store={createStore()}>
        <TooltipProvider>
          <SelectionSpeechProvider>
            <SpeakButton />
            <MenuRow />
          </SelectionSpeechProvider>
        </TooltipProvider>
      </Provider>,
    )

    expect(tts.instances).toBe(1)
    // The button and the row both read as playing.
    expect(screen.getAllByRole("button", { name: i18n.t("action.playing") })).toHaveLength(2)

    fireEvent.click(screen.getByTestId("menu-row"))
    expect(tts.stop).toHaveBeenCalledWith(1)
  })
})
