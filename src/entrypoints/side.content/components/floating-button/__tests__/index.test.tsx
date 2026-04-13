// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { atom } from "jotai"
import { beforeAll, describe, expect, it, vi } from "vitest"
import FloatingButton from ".."

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getURL: (path = "") => `chrome-extension://test-extension${path}`,
    },
  },
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    floatingButton: atom({
      enabled: true,
      position: 0.66,
      clickAction: "panel",
      disabledFloatingButtonPatterns: [],
    }),
    sideContent: atom({ width: 360 }),
  },
}))

vi.mock("../../../atoms", () => ({
  enablePageTranslationAtom: atom({ enabled: false }),
  isDraggingButtonAtom: atom(false),
  isSideOpenAtom: atom(false),
}))

vi.mock("../../../index", () => ({
  shadowWrapper: document.body,
}))

vi.mock("../translate-button", () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="translate-button" className={className} />
  ),
}))

vi.mock("../components/hidden-button", () => ({
  default: ({ className, onClick }: { className?: string, onClick: () => void }) => (
    <button type="button" data-testid="hidden-button" className={className} onClick={onClick} />
  ),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn(),
}))

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
})

describe("floatingButton close trigger", () => {
  it("keeps the close trigger in the layout with visibility classes instead of display:none", () => {
    render(<FloatingButton />)

    const closeTrigger = screen.getByTitle("Close floating button")

    expect(closeTrigger).toHaveClass("invisible")
    expect(closeTrigger).toHaveClass("group-hover:visible")
    expect(closeTrigger).not.toHaveClass("hidden")
    expect(closeTrigger).not.toHaveClass("group-hover:block")
  })

  it("forces the close trigger visible while the dropdown is open", () => {
    render(<FloatingButton />)

    const closeTrigger = screen.getByTitle("Close floating button")
    fireEvent.click(closeTrigger)

    expect(closeTrigger).toHaveClass("visible")
    expect(screen.getByText("options.floatingButtonAndToolbar.floatingButton.closeMenu.disableForSite")).toBeInTheDocument()
  })
})
