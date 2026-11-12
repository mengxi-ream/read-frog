// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { findSelectionToolbarAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { ContextMenuPreview } from "../context-menu-preview"

const { selectionToolbarAtom, testState } = vi.hoisted(() => ({
  selectionToolbarAtom: {},
  testState: {
    selectionToolbar: null as Config["selectionToolbar"] | null,
  },
}))

vi.mock("jotai", () => ({
  useAtomValue: (atom: object) => {
    if (atom !== selectionToolbarAtom || !testState.selectionToolbar) {
      throw new Error("Unexpected atom")
    }
    return testState.selectionToolbar
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    selectionToolbar: selectionToolbarAtom,
  },
}))

describe("context menu preview", () => {
  beforeEach(() => {
    testState.selectionToolbar = structuredClone(DEFAULT_CONFIG.selectionToolbar)
    i18n.t = vi.fn<(...args: any[]) => any>(
      (key: string) =>
        ({
          "contextMenu.translateSelection": 'Translate "%s"',
          "contextMenu.readAloudSelection": 'Read aloud "%s"',
        })[key] ?? key,
    ) as typeof i18n.t
  })

  it("fills the selection into the translate and read-aloud items", () => {
    render(<ContextMenuPreview />)

    const preview = screen.getByRole("img")
    expect(preview).toHaveTextContent('Translate "Mr. Kamiya"')
    expect(preview).toHaveTextContent('Read aloud "Mr. Kamiya"')
    expect(preview).not.toHaveTextContent("%s")
  })

  it("shows the enabled actions and not the ones turned off", () => {
    testState.selectionToolbar!.builtInActions.improveWriting.enabled = false
    testState.selectionToolbar!.customActions = [
      { id: "rewrite", name: "Rewrite", enabled: true },
      { id: "summarize", name: "Summarize", enabled: false },
    ] as Config["selectionToolbar"]["customActions"]

    render(<ContextMenuPreview />)

    const nameOf = (id: string) => findSelectionToolbarAction(testState.selectionToolbar!, id)!.name
    const preview = screen.getByRole("img")
    expect(preview).toHaveTextContent("Rewrite")
    expect(preview).not.toHaveTextContent("Summarize")
    expect(preview).toHaveTextContent(nameOf("default-dictionary"))
    expect(preview).not.toHaveTextContent(nameOf("default-improve-writing"))
  })

  it("is one labelled image to assistive technology", () => {
    render(<ContextMenuPreview />)

    expect(screen.getByRole("img")).toHaveAccessibleName("options.contextMenu.demoImageAlt")
  })
})
