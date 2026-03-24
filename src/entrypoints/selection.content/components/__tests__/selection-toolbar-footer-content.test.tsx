// @vitest-environment jsdom
import type { ProviderConfig } from "@/types/config/provider"
import { i18n } from "#imports"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { SelectionToolbarFooterContent } from "../selection-toolbar-footer-content"

vi.mock("@/components/llm-providers/provider-selector", () => ({
  default: ({
    className,
    onChange,
    providers,
    value,
  }: {
    className?: string
    onChange: (id: string) => void
    providers: ProviderConfig[]
    value: string
  }) => {
    const nextProvider = providers.find(provider => provider.id !== value)

    return (
      <button
        type="button"
        data-testid="provider-selector"
        className={className}
        onClick={() => {
          if (nextProvider) {
            onChange(nextProvider.id)
          }
        }}
      >
        {value}
      </button>
    )
  },
}))

describe("selectionToolbarFooterContent", () => {
  const providers: ProviderConfig[] = [
    {
      id: "google-translate-default",
      name: "Google Translate",
      enabled: true,
      provider: "google-translate",
    },
    {
      id: "microsoft-translate-default",
      name: "Microsoft Translate",
      enabled: true,
      provider: "microsoft-translate",
    },
  ]

  it("renders the provider selector and forwards footer actions", async () => {
    const onProviderChange = vi.fn()
    const onRegenerate = vi.fn()

    render(
      <TooltipProvider>
        <SelectionToolbarFooterContent
          paragraphsText="Context text"
          providers={providers}
          titleText="Page Title"
          value="google-translate-default"
          onProviderChange={onProviderChange}
          onRegenerate={onRegenerate}
        />
      </TooltipProvider>,
    )

    fireEvent.click(screen.getByTestId("provider-selector"))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "action.viewContextDetails" }))
      await Promise.resolve()
    })

    expect(onProviderChange).toHaveBeenCalledWith("microsoft-translate-default")
    expect(screen.getByText(i18n.t("action.contextDetailsTitleLabel"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("action.contextDetailsParagraphsLabel"))).toBeInTheDocument()
    expect(screen.getByText("Page Title")).toBeInTheDocument()
    expect(screen.getByText("Context text")).toBeInTheDocument()
    const contextPreview = screen.getByText("Context text").closest("[data-slot='selection-toolbar-footer-preview-value']")

    expect(contextPreview).toHaveClass("max-h-36", "overflow-y-auto", "break-words")
    expect(contextPreview?.className).toContain("[overflow-wrap:anywhere]")

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "action.regenerate" }))
      await Promise.resolve()
    })

    expect(onRegenerate).toHaveBeenCalledTimes(1)
  })

  it("shows placeholders when title and context are empty", async () => {
    render(
      <TooltipProvider>
        <SelectionToolbarFooterContent
          paragraphsText={null}
          providers={providers}
          titleText=""
          value="google-translate-default"
          onProviderChange={vi.fn()}
          onRegenerate={vi.fn()}
        />
      </TooltipProvider>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "action.viewContextDetails" }))
      await Promise.resolve()
    })

    expect(screen.getAllByText("—")).toHaveLength(2)
  })
})
