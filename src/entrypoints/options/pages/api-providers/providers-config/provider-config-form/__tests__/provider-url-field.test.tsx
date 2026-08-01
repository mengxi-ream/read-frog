// @vitest-environment jsdom

import type { APIProviderConfig } from "@/types/config/provider"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { formOpts, useAppForm } from "../form"
import { ProviderURLField } from "../provider-url-field"

function ProviderURLFieldHarness({ providerConfig }: { providerConfig: APIProviderConfig }) {
  const form = useAppForm({
    ...formOpts,
    defaultValues: providerConfig,
    onSubmit: async () => {},
  })

  return <ProviderURLField form={form} />
}

describe("ProviderURLField", () => {
  it("renders the full endpoint URL for Open Responses", () => {
    render(<ProviderURLFieldHarness providerConfig={DEFAULT_PROVIDER_CONFIG["open-responses"]} />)

    expect(screen.getByText("options.apiProviders.form.fields.url")).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toHaveAttribute("id", "url")
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      "https://api.example.com/v1/responses",
    )
  })

  it("renders a required Base URL for OpenAI-compatible adapters", () => {
    render(
      <ProviderURLFieldHarness providerConfig={DEFAULT_PROVIDER_CONFIG["openai-compatible"]} />,
    )

    expect(screen.getByText("options.apiProviders.form.fields.baseURL")).toBeInTheDocument()
    expect(
      screen.queryByText(
        "options.apiProviders.form.fields.baseURL (options.apiProviders.form.fields.optional)",
      ),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("textbox")).toHaveAttribute("id", "baseURL")
  })

  it("renders an optional Base URL for dedicated SDK providers", () => {
    render(<ProviderURLFieldHarness providerConfig={DEFAULT_PROVIDER_CONFIG.anthropic} />)

    expect(
      screen.getByText(
        "options.apiProviders.form.fields.baseURL (options.apiProviders.form.fields.optional)",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toHaveAttribute("id", "baseURL")
  })
})
