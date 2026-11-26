// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { FloatingButtonPreview } from "../floating-button-preview"

const { floatingButtonAtom, testState } = vi.hoisted(() => ({
  floatingButtonAtom: {},
  testState: {
    floatingButton: null as Config["floatingButton"] | null,
  },
}))

vi.mock("jotai", () => ({
  useAtomValue: (atom: object) => {
    if (atom !== floatingButtonAtom || !testState.floatingButton) {
      throw new Error("Unexpected atom")
    }
    return testState.floatingButton
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    floatingButton: floatingButtonAtom,
  },
}))

describe("floating button preview", () => {
  beforeEach(() => {
    testState.floatingButton = structuredClone(DEFAULT_CONFIG.floatingButton)
  })

  it("shows the lock open while the button can be dragged", () => {
    testState.floatingButton!.locked = false

    render(<FloatingButtonPreview />)

    const preview = screen.getByRole("img")
    expect(preview.querySelector(".tabler-icon-lock-open")).not.toBeNull()
    expect(preview.querySelector(".tabler-icon-lock")).toBeNull()
  })

  it("shows the lock closed once its position is locked", () => {
    testState.floatingButton!.locked = true

    render(<FloatingButtonPreview />)

    const preview = screen.getByRole("img")
    expect(preview.querySelector(".tabler-icon-lock")).not.toBeNull()
    expect(preview.querySelector(".tabler-icon-lock-open")).toBeNull()
  })

  it("is one labelled image to assistive technology", () => {
    render(<FloatingButtonPreview />)

    expect(screen.getByRole("img")).toHaveAccessibleName("options.floatingButton.demoImageAlt")
  })
})
