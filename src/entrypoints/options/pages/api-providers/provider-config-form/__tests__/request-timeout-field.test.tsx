// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { APIProviderConfig } from "@/types/config/provider"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useEffect, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { formOpts, useAppForm } from "../form"
import { RequestTimeoutField } from "../request-timeout-field"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/components/help-tooltip", () => ({
  HelpTooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

const baseProviderConfig: APIProviderConfig = {
  id: "provider-1",
  name: "Custom Provider",
  enabled: true,
  provider: "openai-compatible",
  baseURL: "https://api.example.com/v1",
  model: {
    model: "use-custom-model",
    isCustomModel: true,
    customModel: "hymt2-q4:latest",
  },
}

function RequestTimeoutFieldHarness({ initialConfig }: { initialConfig: APIProviderConfig }) {
  const [providerConfig, setProviderConfig] = useState(initialConfig)
  const form = useAppForm({
    ...formOpts,
    defaultValues: providerConfig,
    onSubmit: async ({ value }) => {
      setProviderConfig(value)
    },
  })

  useEffect(() => {
    form.reset(providerConfig)
  }, [providerConfig, form])

  return (
    <>
      <RequestTimeoutField form={form} />
      <output aria-label="persisted-request-timeout">{providerConfig.requestTimeoutMs ?? ""}</output>
    </>
  )
}

describe("requestTimeoutField", () => {
  it("saves requestTimeoutMs on API provider config", async () => {
    render(<RequestTimeoutFieldHarness initialConfig={baseProviderConfig} />)

    fireEvent.change(screen.getByLabelText("options.apiProviders.form.requestTimeout"), {
      target: { value: "600000" },
    })

    await waitFor(() => {
      expect(screen.getByLabelText("persisted-request-timeout")).toHaveTextContent("600000")
    })
  })
})
