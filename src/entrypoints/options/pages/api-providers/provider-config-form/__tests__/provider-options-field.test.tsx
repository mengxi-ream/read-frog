// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { APIProviderConfig } from "@/types/config/provider"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useEffect, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { updateProviderConfig } from "@/utils/atoms/provider"
import { formOpts, useAppForm } from "../form"
import { ProviderOptionsField } from "../provider-options-field"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/components/help-tooltip", () => ({
  HelpTooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/json-code-editor", () => ({
  JSONCodeEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string
    onChange?: (value: string) => void
    placeholder?: string
  }) => (
    <textarea
      aria-label="provider-options-editor"
      value={value}
      placeholder={placeholder}
      onChange={event => onChange?.(event.target.value)}
    />
  ),
}))

const baseProviderConfig: APIProviderConfig = {
  id: "provider-1",
  name: "OpenAI",
  enabled: true,
  provider: "openai",
  model: {
    model: "gpt-5-mini",
    isCustomModel: false,
    customModel: null,
  },
  providerOptions: undefined,
}

function ProviderOptionsFieldHarness({
  initialConfig,
  externalProviderOptions,
}: {
  initialConfig: APIProviderConfig
  externalProviderOptions?: Record<string, unknown>
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
      <ProviderOptionsField form={form} />
      <button
        type="button"
        onClick={() => {
          if (externalProviderOptions === undefined) {
            return
          }

          setProviderConfig(updateProviderConfig(providerConfig, {
            providerOptions: externalProviderOptions,
          }) as APIProviderConfig)
        }}
      >
        apply-external
      </button>
    </>
  )
}

describe("providerOptionsField", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("preserves local formatting when a successful editor save echoes back through the form", async () => {
    render(<ProviderOptionsFieldHarness initialConfig={baseProviderConfig} />)

    const editor = screen.getByLabelText("provider-options-editor")
    fireEvent.change(editor, { target: { value: "{\"reasoningEffort\":\"minimal\"}" } })

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(screen.getByLabelText("provider-options-editor")).toHaveValue("{\"reasoningEffort\":\"minimal\"}")
  })

  it("syncs the editor when an external update arrives, even if the saved value is unchanged", async () => {
    const externalProviderOptions = { enableThinking: false }

    render(
      <ProviderOptionsFieldHarness
        initialConfig={{
          ...baseProviderConfig,
          providerOptions: externalProviderOptions,
        }}
        externalProviderOptions={externalProviderOptions}
      />,
    )

    const editor = screen.getByLabelText("provider-options-editor")
    fireEvent.change(editor, { target: { value: "{" } })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "apply-external" }))
      await Promise.resolve()
    })

    expect(screen.getByLabelText("provider-options-editor")).toHaveValue(JSON.stringify(externalProviderOptions, null, 2))
  })
})
