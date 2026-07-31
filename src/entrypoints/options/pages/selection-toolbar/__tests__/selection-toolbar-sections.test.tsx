// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { ActionsSection } from "../actions"
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

    render(<ActionsSection />)
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

  it("adds a disabled site without dropping the rest of the toolbar config", () => {
    const selectionToolbar = testState.selectionToolbar!

    render(<DisplaySection />)

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "example.com" } })
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })

    expect(setSelectionToolbarMock).toHaveBeenCalledWith({
      ...selectionToolbar,
      disabledSelectionToolbarPatterns: [
        "example.com",
        ...selectionToolbar.disabledSelectionToolbarPatterns,
      ],
    })
  })
})
