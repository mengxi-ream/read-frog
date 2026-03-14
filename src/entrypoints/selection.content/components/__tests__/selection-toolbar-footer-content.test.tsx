// @vitest-environment jsdom
import type { ProviderConfig } from "@/types/config/provider"
import { fireEvent, render, screen } from "@testing-library/react"
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

  it("renders the provider selector and forwards footer actions", () => {
    const onProviderChange = vi.fn()
    const onRegenerate = vi.fn()

    render(
      <TooltipProvider>
        <SelectionToolbarFooterContent
          providers={providers}
          value="google-translate-default"
          onProviderChange={onProviderChange}
          onRegenerate={onRegenerate}
        />
      </TooltipProvider>,
    )

    fireEvent.click(screen.getByTestId("provider-selector"))
    fireEvent.click(screen.getByRole("button", { name: "action.regenerate" }))

    expect(onProviderChange).toHaveBeenCalledWith("microsoft-translate-default")
    expect(onRegenerate).toHaveBeenCalledTimes(1)
  })
})
