// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { findSelectionToolbarAction } from "@/utils/custom-actions"
import { ANNOTATION_ICON } from "@/utils/iconify/bundled-icons"
import { SelectionToolbarPreview } from "../selection-toolbar-preview"

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

// Iconify's <Icon> is already a span carrying its icon name (vitest.setup.ts); give the two
// feature buttons' icons names too, so the toolbar reads as a list.
vi.mock("@remixicon/react", () => ({
  RiTranslate: () => <span data-icon="translate" />,
}))
vi.mock("@tabler/icons-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tabler/icons-react")>()),
  IconVolume: () => <span data-icon="speak" />,
}))

function iconOf(actionId: string) {
  return findSelectionToolbarAction(testState.selectionToolbar!, actionId)!.icon
}

function toolbarIcons() {
  return [...screen.getByRole("img").querySelectorAll("[data-icon]")].map((icon) =>
    icon.getAttribute("data-icon"),
  )
}

describe("selection toolbar preview", () => {
  beforeEach(() => {
    testState.selectionToolbar = structuredClone(DEFAULT_CONFIG.selectionToolbar)
  })

  it("shows the annotation button, then the pinned items in the toolbar's order", () => {
    render(<SelectionToolbarPreview />)

    // Improve Writing starts unpinned: it waits in the "more" menu.
    expect(toolbarIcons()).toEqual([
      ANNOTATION_ICON,
      "translate",
      "speak",
      iconOf("default-dictionary"),
      iconOf("default-sentence-analysis"),
    ])
  })

  it("leaves out items that are unpinned or turned off, and the annotation button when it's off", () => {
    testState.selectionToolbar!.annotation.enabled = false
    testState.selectionToolbar!.features.speak.enabled = false
    testState.selectionToolbar!.unpinned = ["translate", "default-improve-writing"]

    render(<SelectionToolbarPreview />)

    expect(toolbarIcons()).toEqual([
      iconOf("default-dictionary"),
      iconOf("default-sentence-analysis"),
    ])
  })

  it("draws the toolbar at the opacity the settings give it", () => {
    testState.selectionToolbar!.opacity = 60

    render(<SelectionToolbarPreview />)

    const toolbar = screen
      .getByRole("img")
      .querySelector("[data-icon='translate']")!
      .closest<HTMLElement>("[style*='opacity']")
    expect(toolbar).toHaveStyle({ opacity: "0.6" })
  })
})
