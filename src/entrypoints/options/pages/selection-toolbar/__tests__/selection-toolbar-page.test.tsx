// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SelectionToolbarPage } from "../index"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/components/gradient-background", () => ({
  GradientBackground: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("../../../components/page-layout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

vi.mock("../selection-toolbar-global-toggle", () => ({
  SelectionToolbarGlobalToggle: () => <section data-section="global-toggle" />,
}))

vi.mock("../selection-toolbar-opacity", () => ({
  SelectionToolbarOpacity: () => <section data-section="opacity" />,
}))

vi.mock("../selection-toolbar-feature-toggles", () => ({
  SelectionToolbarFeatureToggles: () => <section data-section="feature-toggles" />,
}))

vi.mock("../selection-translation-shortcut", () => ({
  SelectionTranslationShortcut: () => <section data-section="selection-translation-shortcut" />,
}))

vi.mock("../selection-toolbar-disabled-sites", () => ({
  SelectionToolbarDisabledSites: () => <section data-section="disabled-sites" />,
}))

describe("selection toolbar page", () => {
  it("renders the selection translation shortcut between feature toggles and disabled sites", () => {
    const { container } = render(<SelectionToolbarPage />)

    const sections = [...container.querySelectorAll("[data-section]")].map(section =>
      section.getAttribute("data-section"),
    )

    expect(sections).toEqual([
      "global-toggle",
      "opacity",
      "feature-toggles",
      "selection-translation-shortcut",
      "disabled-sites",
    ])
  })
})
