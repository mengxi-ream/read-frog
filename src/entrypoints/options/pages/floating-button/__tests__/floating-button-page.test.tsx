// @vitest-environment jsdom

import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FloatingButtonPage } from ".."

vi.mock("../../../components/page-layout", () => ({
  PageLayout: ({ description, children }: { description: ReactNode; children: ReactNode }) => (
    <div>
      <p>{description}</p>
      {children}
    </div>
  ),
}))
vi.mock("../floating-button-preview", () => ({ FloatingButtonPreview: () => null }))
vi.mock("../display", () => ({ DisplaySection: () => <section>display</section> }))
vi.mock("../click-action", () => ({ ClickActionSection: () => <section>click action</section> }))

describe("floating button page", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each(["chrome", "edge", "firefox"])("lets a click open the side panel in %s", (target) => {
    vi.stubEnv("BROWSER", target)
    render(<FloatingButtonPage />)

    expect(screen.getByText("click action")).toBeInTheDocument()
    expect(screen.getByText("options.floatingButton.pageDescription")).toBeInTheDocument()
  })

  it("has no click action to set in Safari, which has no side panel", () => {
    vi.stubEnv("BROWSER", "safari")
    render(<FloatingButtonPage />)

    expect(screen.queryByText("click action")).toBeNull()
    expect(screen.getByText("display")).toBeInTheDocument()
    expect(
      screen.getByText("options.floatingButton.pageDescriptionWithoutClickAction"),
    ).toBeInTheDocument()
  })
})
