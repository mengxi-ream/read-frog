// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import type { FeatureId } from "@/utils/features"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { isFeatureOn, setFeatureOn } from "@/utils/features"
import { ActionsSection } from "../actions"
import { AnnotationSection } from "../annotation"
import { DisplaySection } from "../display"

const {
  configAtom,
  selectionToolbarAtom,
  writeConfigAtom,
  setSelectionToolbarMock,
  writeConfigMock,
  testState,
} = vi.hoisted(() => ({
  configAtom: {},
  selectionToolbarAtom: {},
  writeConfigAtom: {},
  setSelectionToolbarMock: vi.fn<(value: Partial<Config["selectionToolbar"]>) => Promise<void>>(),
  writeConfigMock: vi.fn<(patch: Partial<Config>) => Promise<void>>(),
  testState: {
    config: null as Config | null,
  },
}))

function currentConfig() {
  if (!testState.config) {
    throw new Error("No config")
  }
  return testState.config
}

vi.mock("jotai", () => ({
  useAtom: (atom: object) => {
    if (atom !== selectionToolbarAtom) {
      throw new Error("Unexpected atom")
    }
    return [currentConfig().selectionToolbar, setSelectionToolbarMock]
  },
  useAtomValue: (atom: object) => {
    if (atom !== configAtom) {
      throw new Error("Unexpected atom")
    }
    return currentConfig()
  },
  useSetAtom: (atom: object) => {
    if (atom !== writeConfigAtom) {
      throw new Error("Unexpected atom")
    }
    return writeConfigMock
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configAtom,
  writeConfigAtom,
  configFieldsAtomMap: {
    selectionToolbar: selectionToolbarAtom,
  },
}))

vi.mock("@/hooks/use-feature-on", () => ({
  useFeatureOn: (id: FeatureId) => isFeatureOn(currentConfig(), id),
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
    testState.config = structuredClone(DEFAULT_CONFIG)
    setSelectionToolbarMock.mockReset()
    setSelectionToolbarMock.mockResolvedValue()
    writeConfigMock.mockReset()
    writeConfigMock.mockResolvedValue()
  })

  it("switches one built-in action at a time, leaving the other on", () => {
    // Its rows link to their keys on the Shortcuts page.
    render(
      <MemoryRouter>
        <ActionsSection />
      </MemoryRouter>,
    )
    // Save suggestions sit under translate, between the two.
    const [translate, noteSuggestion, speak] = screen.getAllByRole("switch")

    fireEvent.click(speak!)

    expect(writeConfigMock).toHaveBeenCalledExactlyOnceWith(
      setFeatureOn("selectionToolbar.speak", false),
    )
    expect(translate).toBeChecked()
    expect(noteSuggestion).toBeChecked()
  })

  it("keeps save suggestions' own switch, disabled, while translate is off", () => {
    const { features } = currentConfig().selectionToolbar
    features.translate = { ...features.translate, enabled: false }

    render(
      <MemoryRouter>
        <ActionsSection />
      </MemoryRouter>,
    )
    const [translate, noteSuggestion, speak] = screen.getAllByRole("switch")

    expect(translate).not.toBeChecked()
    expect(noteSuggestion).toBeChecked()
    expect(noteSuggestion).toHaveAttribute("aria-disabled", "true")
    expect(speak).not.toHaveAttribute("aria-disabled", "true")
  })

  it("switches the annotation slot, leaving the toolbar's other settings alone", () => {
    // Its row links to its key on the Shortcuts page.
    render(
      <MemoryRouter>
        <AnnotationSection />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole("switch"))

    expect(writeConfigMock).toHaveBeenCalledExactlyOnceWith({
      selectionToolbar: { annotation: { enabled: false } },
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
    const { selectionToolbar } = currentConfig()

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
