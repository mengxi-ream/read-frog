// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ModelIcon } from "../model-icon"

vi.mock("@/utils/content-script/background-asset-url", () => ({
  resolveContentScriptAssetBlob: vi.fn<(url: string) => Promise<Blob | null>>(),
  shouldProxyAssetUrl: () => false,
}))

function getFrog(container: HTMLElement) {
  return container.querySelector<HTMLImageElement>('[data-slot="model-icon-badge"]')
}

describe("ModelIcon", () => {
  it("shows the vendor's 12px logo in the 20px circle, with a 10px frog on the corner", () => {
    const { container } = render(<ModelIcon vendor="openai" name="GPT-6 Luna" theme="light" />)

    const logo = screen.getByRole("img", { name: "GPT-6 Luna" })
    expect(logo.getAttribute("src")).toMatch(/openai/)
    expect(logo).toHaveClass("size-3")
    expect(logo.parentElement).toHaveClass("size-5", "relative")

    const frog = getFrog(container)
    expect(frog?.getAttribute("src")).toMatch(/read-frog-provider/)
    // 10px, hanging 3px past the circle: its centre stays 2px inside the
    // circle's edge, where the 12px frog's sat at 4px.
    expect(frog).toHaveClass("absolute", "size-2.5", "-right-[3px]", "-bottom-[3px]")
    expect(frog?.parentElement).toBe(logo.parentElement)
  })

  it("keeps the frog out of the accessible name, which is the model's", () => {
    const { container } = render(
      <ModelIcon vendor="anthropic" name="Claude Haiku 5.5" theme="light" />,
    )

    expect(getFrog(container)).toHaveAttribute("aria-hidden", "true")
    expect(getFrog(container)).toHaveAttribute("alt", "")
    expect(screen.getAllByRole("img")).toHaveLength(1)
  })

  it("scales the frog with the settings page's larger circle", () => {
    const { container } = render(
      <ModelIcon vendor="deepseek" name="DeepSeek V4.1 Flash" theme="light" size="base" />,
    )

    expect(getFrog(container)).toHaveClass("size-3", "-right-[3px]", "-bottom-[3px]")
  })

  it("shows the frog alone, with no badge, when the vendor is unknown", () => {
    const { container } = render(<ModelIcon vendor={null} name="gpt-5-mini" theme="light" />)

    expect(screen.getByRole("img", { name: "gpt-5-mini" }).getAttribute("src")).toMatch(
      /read-frog-provider/,
    )
    expect(getFrog(container)).toBeNull()
  })

  it("treats a vendor the extension has no logo for as unknown", () => {
    const { container } = render(<ModelIcon vendor="acme" name="Acme 1" theme="light" />)

    expect(screen.getByRole("img", { name: "Acme 1" }).getAttribute("src")).toMatch(
      /read-frog-provider/,
    )
    expect(getFrog(container)).toBeNull()
  })
})
