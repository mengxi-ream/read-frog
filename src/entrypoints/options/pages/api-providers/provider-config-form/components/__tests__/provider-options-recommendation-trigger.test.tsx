// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProviderOptionsRecommendationTrigger } from "../provider-options-recommendation-trigger"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/components/ui/json-code-editor", () => ({
  JSONCodeEditor: ({
    value,
    placeholder,
  }: {
    value?: string
    placeholder?: string
  }) => (
    <pre data-testid="provider-options-preview">
      {value || placeholder}
    </pre>
  ),
}))

describe("providerOptionsRecommendationTrigger", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("does not render a trigger when the current model has no recommendation", () => {
    render(
      <ProviderOptionsRecommendationTrigger
        providerId="provider-1"
        modelId="plain-model"
        onApply={vi.fn()}
      />,
    )

    expect(screen.queryByRole("button", {
      name: "options.apiProviders.form.providerOptionsRecommendationTrigger",
    })).not.toBeInTheDocument()
  })

  it("does not render a trigger for GPT-5 chat-latest models", () => {
    render(
      <ProviderOptionsRecommendationTrigger
        providerId="provider-1"
        modelId="gpt-5.3-chat-latest"
        onApply={vi.fn()}
      />,
    )

    expect(screen.queryByRole("button", {
      name: "options.apiProviders.form.providerOptionsRecommendationTrigger",
    })).not.toBeInTheDocument()
  })

  it("flashes once when the model starts matching a new recommendation rule", () => {
    const { rerender } = render(
      <ProviderOptionsRecommendationTrigger
        providerId="provider-1"
        modelId="gpt-5-mini"
        onApply={vi.fn()}
      />,
    )

    const trigger = screen.getByRole("button", {
      name: "options.apiProviders.form.providerOptionsRecommendationTrigger",
    })
    expect(trigger.className).not.toContain("text-primary")

    rerender(
      <ProviderOptionsRecommendationTrigger
        providerId="provider-1"
        modelId="gpt-5.4-mini"
        onApply={vi.fn()}
      />,
    )

    expect(trigger.className).toContain("text-primary")

    act(() => {
      vi.advanceTimersByTime(1400)
    })

    expect(trigger.className).not.toContain("text-primary")
  })

  it("shows the recommendation preview and applies it on demand", () => {
    const onApply = vi.fn()

    render(
      <ProviderOptionsRecommendationTrigger
        providerId="provider-1"
        modelId="gpt-5.4-mini"
        onApply={onApply}
      />,
    )

    fireEvent.click(screen.getByRole("button", {
      name: "options.apiProviders.form.providerOptionsRecommendationTrigger",
    }))

    expect(screen.getByText("options.apiProviders.form.providerOptionsRecommendationTitle")).toBeInTheDocument()
    expect(screen.getByTestId("provider-options-preview")).toHaveTextContent("\"reasoningEffort\": \"none\"")

    fireEvent.click(screen.getByRole("button", {
      name: "options.apiProviders.form.providerOptionsRecommendationApply",
    }))

    expect(onApply).toHaveBeenCalledWith({ reasoningEffort: "none" })
  })

  it("renders Kimi recommendations based on model name alone", () => {
    render(
      <ProviderOptionsRecommendationTrigger
        providerId="provider-1"
        modelId="moonshotai/Kimi-K2-Instruct"
        onApply={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", {
      name: "options.apiProviders.form.providerOptionsRecommendationTrigger",
    })).toBeInTheDocument()
  })
})
