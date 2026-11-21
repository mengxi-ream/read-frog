// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { ActionsSection } from "../actions"
import { AnnotationSection } from "../annotation"
import { DisplaySection } from "../display"
import { EnableItem } from "../enable-item"

const { selectionToolbarAtom, setSelectionToolbarMock, testState } = vi.hoisted(() => ({
  selectionToolbarAtom: {},
  setSelectionToolbarMock: vi.fn<(value: Partial<Config["selectionToolbar"]>) => Promise<void>>(),
  testState: {
    selectionToolbar: null as Config["selectionToolbar"] | null,
  },
}))

vi.mock("jotai", () => ({
  useAtom: (atom: object) => {
    if (atom !== selectionToolbarAtom || !testState.selectionToolbar) {
      throw new Error("Unexpected atom")
    }
    return [testState.selectionToolbar, setSelectionToolbarMock]
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    selectionToolbar: selectionToolbarAtom,
  },
}))

// The note-suggestion provider row pulls in the full provider stack (jotai
// atoms, hosted-AI status queries); this suite only cares about the section
// wiring, so keep that row shallow.
vi.mock("@/components/llm-providers/use-feature-providers", () => ({
  useFeatureProvider: () => ({
    providers: [],
    providerId: "read-frog-ai:gpt-6-luna",
    providerConfig: null,
    setProviderId: vi.fn<(id: string) => void>(),
  }),
}))

vi.mock("@/components/llm-providers/provider-selector", () => ({
  default: () => <div>ProviderSelector</div>,
}))

// Base UI's select, driven as in video-subtitles-sections.test.tsx: the mousedown also schedules
// an open for the next frame, which has to run before an option is picked.
async function pick(trigger: HTMLElement, optionText: string) {
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "click"]) {
      trigger.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
    }
  })
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  const option = (await screen.findAllByRole("option")).find(
    (element) => element.textContent === optionText,
  )!
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      option.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
    }
  })
}

describe("selection toolbar page sections", () => {
  beforeEach(() => {
    testState.selectionToolbar = structuredClone(DEFAULT_CONFIG.selectionToolbar)
    setSelectionToolbarMock.mockReset()
    setSelectionToolbarMock.mockResolvedValue()
  })

  it("writes the page-wide switch without touching the rest of the config", () => {
    const selectionToolbar = testState.selectionToolbar!

    render(<EnableItem />)
    fireEvent.click(screen.getByRole("switch"))

    expect(setSelectionToolbarMock).toHaveBeenCalledWith({
      ...selectionToolbar,
      enabled: !selectionToolbar.enabled,
    })
  })

  it("switches one built-in action at a time, leaving the other enabled", () => {
    const selectionToolbar = testState.selectionToolbar!

    // Its rows link to their keys on the Shortcuts page.
    render(
      <MemoryRouter>
        <ActionsSection />
      </MemoryRouter>,
    )
    const [translate, speak] = screen.getAllByRole("switch")

    fireEvent.click(speak!)

    expect(setSelectionToolbarMock).toHaveBeenCalledWith({
      ...selectionToolbar,
      features: {
        ...selectionToolbar.features,
        speak: { ...selectionToolbar.features.speak, enabled: false },
      },
    })
    expect(translate).toBeChecked()
  })

  it("switches the annotation slot, leaving the toolbar's other settings alone", () => {
    const selectionToolbar = testState.selectionToolbar!

    // Its row links to its key on the Shortcuts page.
    render(
      <MemoryRouter>
        <AnnotationSection />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole("switch"))

    expect(setSelectionToolbarMock).toHaveBeenCalledWith({
      ...selectionToolbar,
      annotation: { ...selectionToolbar.annotation, enabled: false },
    })
    // The provider row is the translate feature's own setting, shown here too.
    expect(screen.getByText("ProviderSelector")).toBeInTheDocument()
  })

  it("pins the toolbar to one side of the selection, writing only the placement", async () => {
    render(<DisplaySection />)

    const placement = (key: string) => `options.selectionToolbar.display.placement.${key}`
    const trigger = screen.getByRole("combobox", { name: placement("title") })
    // Existing users keep the toolbar where it has always opened.
    expect(trigger).toHaveTextContent(placement("followDirection"))

    await pick(trigger, placement("above"))

    expect(setSelectionToolbarMock).toHaveBeenCalledWith({ placement: "above" })
  })

  it("adds a disabled site without dropping the rest of the toolbar config", () => {
    const selectionToolbar = testState.selectionToolbar!

    render(<DisplaySection />)

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "example.com" } })
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })

    expect(setSelectionToolbarMock).toHaveBeenCalledWith({
      ...selectionToolbar,
      // Stored exactly as typed: `example.com` is a pattern with a meaning of
      // its own, and the list must say what the user wrote.
      disabledSelectionToolbarPatterns: [
        "example.com",
        ...selectionToolbar.disabledSelectionToolbarPatterns,
      ],
    })
  })
})
