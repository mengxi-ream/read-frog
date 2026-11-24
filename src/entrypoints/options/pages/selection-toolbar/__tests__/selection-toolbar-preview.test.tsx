// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { cleanup, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { findSelectionToolbarAction } from "@/utils/custom-actions"
import { setFeatureOn } from "@/utils/features"
import { ANNOTATION_ICON } from "@/utils/iconify/bundled-icons"
import { SelectionToolbarPreview } from "../selection-toolbar-preview"

const { configAtom, testState } = vi.hoisted(() => ({
  configAtom: {},
  testState: {
    config: null as Config | null,
  },
}))

vi.mock("jotai", () => ({
  useAtomValue: (atom: object) => {
    if (atom !== configAtom || !testState.config) {
      throw new Error("Unexpected atom")
    }
    return testState.config
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configAtom,
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

function selectionToolbar() {
  return testState.config!.selectionToolbar
}

function iconOf(actionId: string) {
  return findSelectionToolbarAction(selectionToolbar(), actionId)!.icon
}

function hasMoreButton() {
  return screen.getByRole("img").querySelector(".tabler-icon-dots-vertical")
}

function toolbarIcons() {
  return [...screen.getByRole("img").querySelectorAll("[data-icon]")].map((icon) =>
    icon.getAttribute("data-icon"),
  )
}

function separators() {
  return screen.getByRole("img").querySelectorAll(".w-px.self-stretch")
}

describe("selection toolbar preview", () => {
  beforeEach(() => {
    testState.config = structuredClone(DEFAULT_CONFIG)
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
    selectionToolbar().annotation.enabled = false
    selectionToolbar().features.speak.enabled = false
    selectionToolbar().unpinned = ["translate", "default-improve-writing"]

    render(<SelectionToolbarPreview />)

    expect(toolbarIcons()).toEqual([
      iconOf("default-dictionary"),
      iconOf("default-sentence-analysis"),
    ])
  })

  it("draws the toolbar at the opacity the settings give it", () => {
    selectionToolbar().opacity = 60

    render(<SelectionToolbarPreview />)

    const toolbar = screen
      .getByRole("img")
      .querySelector("[data-icon='translate']")!
      .closest<HTMLElement>("[style*='opacity']")
    expect(toolbar).toHaveStyle({ opacity: "0.6" })
  })

  it("leaves out the actions while simple mode has custom actions off, and the more button with nothing to list", () => {
    testState.config = { ...testState.config!, ...setFeatureOn("customActions", false) }

    render(<SelectionToolbarPreview />)

    expect(toolbarIcons()).toEqual([ANNOTATION_ICON, "translate", "speak"])
    expect(hasMoreButton()).not.toBeNull()

    selectionToolbar().features.translate.enabled = false
    selectionToolbar().features.speak.enabled = false
    cleanup()
    render(<SelectionToolbarPreview />)

    expect(toolbarIcons()).toEqual([ANNOTATION_ICON])
    expect(hasMoreButton()).toBeNull()
  })

  it("draws the separator after the annotation button only when something follows it", () => {
    // Word annotation alone: Custom AI Actions, Selection translation and Speak are off.
    testState.config = { ...testState.config!, ...setFeatureOn("customActions", false) }
    selectionToolbar().features.translate.enabled = false
    selectionToolbar().features.speak.enabled = false

    render(<SelectionToolbarPreview />)

    expect(toolbarIcons()).toEqual([ANNOTATION_ICON])
    expect(separators()).toHaveLength(0)

    // Speak back on but unpinned: the "more" button follows the annotation button.
    selectionToolbar().features.speak.enabled = true
    selectionToolbar().unpinned = ["speak"]
    cleanup()
    render(<SelectionToolbarPreview />)

    expect(toolbarIcons()).toEqual([ANNOTATION_ICON])
    expect(hasMoreButton()).not.toBeNull()
    expect(separators()).toHaveLength(1)
  })
})
