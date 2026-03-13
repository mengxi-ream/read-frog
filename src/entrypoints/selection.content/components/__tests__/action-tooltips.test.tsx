// @vitest-environment jsdom
import type { ReactElement } from "react"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CopyButton } from "../copy-button"
import { RegenerateButton } from "../selection-toolbar-footer-content"
import { SpeakButton } from "../speak-button"

vi.mock("@/hooks/use-text-to-speech", () => ({
  useTextToSpeech: () => ({
    play: vi.fn(),
    stop: vi.fn(),
    isFetching: false,
    isPlaying: false,
  }),
}))

describe("selection action tooltips", () => {
  const writeTextMock = vi.fn()

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: writeTextMock,
    },
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  function renderWithProviders(ui: ReactElement) {
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)

    return render(
      <Provider store={store}>
        <TooltipProvider>
          {ui}
        </TooltipProvider>
      </Provider>,
    )
  }

  async function openTooltip(trigger: Element) {
    fireEvent.mouseEnter(trigger)
    fireEvent.focus(trigger)

    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toBeTruthy()
    })

    const tooltip = document.querySelector("[data-slot='tooltip-content']")
    const positioner = tooltip?.parentElement

    if (!tooltip || !positioner) {
      throw new Error("Tooltip did not render")
    }

    return { tooltip, positioner }
  }
  it("renders the copy tooltip above selection popovers", async () => {
    const { container } = renderWithProviders(<CopyButton text="Copied text" />)
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    const { tooltip, positioner } = await openTooltip(trigger!)

    expect(tooltip).toHaveTextContent("action.copy")
    expect(positioner).toHaveClass("z-50")
  })

  it("keeps the copy tooltip open after click and updates its text", async () => {
    const { container } = renderWithProviders(<CopyButton text="Copied text" />)
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    const { tooltip: initialTooltip } = await openTooltip(trigger!)
    expect(initialTooltip).toHaveTextContent("action.copy")

    fireEvent.click(trigger!)

    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toHaveTextContent("action.copied")
    })

    expect(writeTextMock).toHaveBeenCalledWith("Copied text")
  })

  it("renders the speak tooltip above selection popovers", async () => {
    const { container } = renderWithProviders(<SpeakButton text="Speak text" />)
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    const { tooltip, positioner } = await openTooltip(trigger!)

    expect(tooltip).toHaveTextContent("action.speak")
    expect(positioner).toHaveClass("z-50")
  })

  it("renders the regenerate tooltip above selection popovers", async () => {
    const { container } = renderWithProviders(<RegenerateButton onRegenerate={vi.fn()} />)
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    const { tooltip, positioner } = await openTooltip(trigger!)

    expect(tooltip).toHaveTextContent("action.regenerate")
    expect(positioner).toHaveClass("z-50")
  })

  it("keeps the speak tooltip open after click", async () => {
    const { container } = renderWithProviders(<SpeakButton text="Speak text" />)
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    const { tooltip: initialTooltip } = await openTooltip(trigger!)
    expect(initialTooltip).toHaveTextContent("action.speak")

    fireEvent.click(trigger!)

    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toHaveTextContent("action.speak")
    })
  })

  it("keeps the regenerate tooltip open after click", async () => {
    const onRegenerate = vi.fn()
    const { container } = renderWithProviders(<RegenerateButton onRegenerate={onRegenerate} />)
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    const { tooltip: initialTooltip } = await openTooltip(trigger!)
    expect(initialTooltip).toHaveTextContent("action.regenerate")

    fireEvent.click(trigger!)

    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toHaveTextContent("action.regenerate")
    })

    expect(onRegenerate).toHaveBeenCalledTimes(1)
  })
})
