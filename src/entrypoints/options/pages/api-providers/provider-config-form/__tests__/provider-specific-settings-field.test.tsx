// @vitest-environment jsdom
import type { APIProviderConfig } from "@/types/config/provider"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useEffect, useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { formOpts, useAppForm } from "../form"
import { ProviderSpecificSettingsField } from "../provider-specific-settings-field"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

function ProviderSpecificSettingsFieldHarness({
  initialConfig = DEFAULT_PROVIDER_CONFIG.bedrock,
}: {
  initialConfig?: APIProviderConfig
}) {
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
      <ProviderSpecificSettingsField form={form} />
      <output aria-label="persisted-provider-specific-settings">
        {JSON.stringify("providerSpecificSettings" in providerConfig ? providerConfig.providerSpecificSettings : null)}
      </output>
    </>
  )
}

describe("providerSpecificSettingsField", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("renders Bedrock settings from Zod metadata and persists changes", async () => {
    render(<ProviderSpecificSettingsFieldHarness />)

    const regionInput = screen.getByLabelText("options.apiProviders.form.providerSettingLabels.region")
    expect(regionInput).toHaveValue("us-east-1")

    fireEvent.change(regionInput, { target: { value: "us-west-2" } })

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(screen.getByLabelText("persisted-provider-specific-settings")).toHaveTextContent("{\"region\":\"us-west-2\"}")
  })

  it("does not render or write settings for providers without provider-specific schemas", async () => {
    render(<ProviderSpecificSettingsFieldHarness initialConfig={DEFAULT_PROVIDER_CONFIG.openai} />)

    expect(screen.queryByLabelText("options.apiProviders.form.providerSettingLabels.region")).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(screen.getByLabelText("persisted-provider-specific-settings")).toHaveTextContent("null")
  })
})
