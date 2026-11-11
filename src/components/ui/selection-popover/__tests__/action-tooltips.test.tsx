// @vitest-environment jsdom
import type { ReactElement } from "react"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CopyButton } from "../copy-button"
import { ContextDetailsButton, RegenerateButton } from "../selection-toolbar-footer-content"
import { SpeakButton } from "../speak-button"

const { ttsPlayMock } = vi.hoisted(() => ({
  ttsPlayMock: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/hooks/use-text-to-speech", () => ({
  selectTTSVoice: (_config: unknown, language: string) => `voice:${language}`,
  useTextToSpeech: () => ({
    play: ttsPlayMock,
    stop: vi.fn<(...args: any[]) => any>(),
    isFetching: false,
    isPlaying: false,
  }),
}))

describe("selection action tooltips", () => {
  const writeTextMock = vi.fn<(...args: any[]) => any>()

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
        <TooltipProvider>{ui}</TooltipProvider>
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

  async function expectTooltipClosesOnHoverLeave(trigger: Element) {
    await openTooltip(trigger)

    fireEvent.mouseLeave(trigger)
    fireEvent.blur(trigger)

    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toBeNull()
    })
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
      expect(document.querySelector("[data-slot='tooltip-content']")).toHaveTextContent(
        "action.copied",
      )
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
    const { container } = renderWithProviders(
      <RegenerateButton onRegenerate={vi.fn<(...args: any[]) => any>()} />,
    )
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    const { tooltip, positioner } = await openTooltip(trigger!)

    expect(tooltip).toHaveTextContent("action.regenerate")
    expect(positioner).toHaveClass("z-50")
  })

  it("renders the context details tooltip above selection popovers", async () => {
    const { container } = renderWithProviders(
      <ContextDetailsButton titleText="Title" paragraphsText="Context" />,
    )
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    const { tooltip, positioner } = await openTooltip(trigger!)

    expect(tooltip).toHaveTextContent("action.viewContextDetails")
    expect(positioner).toHaveClass("z-50")
  })

  it("speaks with the voice for the text's language when the caller knows it", () => {
    const { container, unmount } = renderWithProviders(
      <SpeakButton text="Bom dia" language="pt-PT" />,
    )
    fireEvent.click(container.querySelector("[data-slot='tooltip-trigger']")!)

    expect(ttsPlayMock).toHaveBeenLastCalledWith("Bom dia", DEFAULT_CONFIG.tts, {
      forcedVoice: "voice:pt-PT",
    })

    unmount()
    const unknown = renderWithProviders(<SpeakButton text="Bom dia" />)
    fireEvent.click(unknown.container.querySelector("[data-slot='tooltip-trigger']")!)

    expect(ttsPlayMock).toHaveBeenLastCalledWith("Bom dia", DEFAULT_CONFIG.tts, undefined)
  })

  it("keeps the speak tooltip open after click", async () => {
    const { container } = renderWithProviders(<SpeakButton text="Speak text" />)
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    const { tooltip: initialTooltip } = await openTooltip(trigger!)
    expect(initialTooltip).toHaveTextContent("action.speak")

    fireEvent.click(trigger!)

    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toHaveTextContent(
        "action.speak",
      )
    })
  })

  it("keeps the regenerate tooltip open after click", async () => {
    const onRegenerate = vi.fn<(...args: any[]) => any>()
    const { container } = renderWithProviders(<RegenerateButton onRegenerate={onRegenerate} />)
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    const { tooltip: initialTooltip } = await openTooltip(trigger!)
    expect(initialTooltip).toHaveTextContent("action.regenerate")

    fireEvent.click(trigger!)

    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toHaveTextContent(
        "action.regenerate",
      )
    })

    expect(onRegenerate).toHaveBeenCalledTimes(1)
  })

  it("keeps the context details tooltip open after click", async () => {
    const { container } = renderWithProviders(
      <ContextDetailsButton titleText="Title" paragraphsText="Context" />,
    )
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    const { tooltip: initialTooltip } = await openTooltip(trigger!)
    expect(initialTooltip).toHaveTextContent("action.viewContextDetails")

    fireEvent.click(trigger!)

    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toHaveTextContent(
        "action.viewContextDetails",
      )
    })
  })

  it("closes the copy tooltip after hover leave", async () => {
    const { container } = renderWithProviders(<CopyButton text="Copied text" />)
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    await expectTooltipClosesOnHoverLeave(trigger!)
  })

  it("closes the speak tooltip after hover leave", async () => {
    const { container } = renderWithProviders(<SpeakButton text="Speak text" />)
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    await expectTooltipClosesOnHoverLeave(trigger!)
  })

  it("closes the regenerate tooltip after hover leave", async () => {
    const { container } = renderWithProviders(
      <RegenerateButton onRegenerate={vi.fn<(...args: any[]) => any>()} />,
    )
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    await expectTooltipClosesOnHoverLeave(trigger!)
  })

  it("closes the context details tooltip after hover leave", async () => {
    const { container } = renderWithProviders(
      <ContextDetailsButton titleText="Title" paragraphsText="Context" />,
    )
    const trigger = container.querySelector("[data-slot='tooltip-trigger']")

    expect(trigger).toBeTruthy()

    await expectTooltipClosesOnHoverLeave(trigger!)
  })
})
