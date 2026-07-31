// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ShortcutsPage } from "../index"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("../../../components/page-layout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

vi.mock("../page-translation-shortcut", () => ({
  PageTranslationShortcut: () => <section data-section="page-translation-shortcut" />,
}))

vi.mock("../translation-mode-shortcut", () => ({
  TranslationModeShortcut: () => <section data-section="translation-mode-shortcut" />,
}))

vi.mock("../selection-translation-shortcut", () => ({
  SelectionTranslationShortcut: () => <section data-section="selection-translation-shortcut" />,
}))

vi.mock("../subtitles-toggle-shortcut", () => ({
  SubtitlesToggleShortcut: () => <section data-section="subtitles-toggle-shortcut" />,
}))

vi.mock("../node-translation-hotkey", () => ({
  NodeTranslationHotkey: () => <section data-section="node-translation-hotkey" />,
}))

describe("shortcuts page", () => {
  it("lists every shortcut, widest scope first", () => {
    const { container } = render(<ShortcutsPage />)

    const sections = [...container.querySelectorAll("[data-section]")].map((section) =>
      section.getAttribute("data-section"),
    )

    expect(sections).toEqual([
      "page-translation-shortcut",
      "translation-mode-shortcut",
      "selection-translation-shortcut",
      "subtitles-toggle-shortcut",
      "node-translation-hotkey",
    ])
  })
})
