// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { APIProviderConfig } from "@/types/config/provider"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useEffect, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { formOpts, useAppForm } from "../form"
import { ProviderHeadersField } from "../provider-headers-field"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/components/help-tooltip", () => ({
  HelpTooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/json-code-editor", () => ({
  JSONCodeEditor: (props: {
    value?: string
    onChange?: (value: string) => void
    onBlur?: () => void
    onFocus?: () => void
    placeholder?: string
  } & {
    "aria-label"?: string
  }) => {
    const {
      value,
      onChange,
      onBlur,
      onFocus,
      placeholder,
    } = props
    return (
      <textarea
        aria-label={props["aria-label"]}
        value={value}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={event => onChange?.(event.target.value)}
        onFocus={onFocus}
      />
    )
  },
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
  headers: undefined,
}

const anthropicProviderConfig: APIProviderConfig = {
  id: "provider-2",
  name: "Anthropic",
  enabled: true,
  provider: "anthropic",
  model: {
    model: "claude-haiku-4-5",
    isCustomModel: false,
    customModel: null,
  },
  headers: {
    Existing: "1",
  },
}

function ProviderHeadersFieldHarness({ initialConfig }: { initialConfig: APIProviderConfig }) {
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
      <ProviderHeadersField form={form} />
      <output aria-label="persisted-headers">{JSON.stringify(providerConfig.headers ?? null)}</output>
    </>
  )
}

function ProviderHeadersFieldSwitchHarness() {
  const [providerConfig, setProviderConfig] = useState(baseProviderConfig)
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
      <button type="button" onClick={() => setProviderConfig(anthropicProviderConfig)}>
        switch-provider
      </button>
      <ProviderHeadersField form={form} />
      <output aria-label="persisted-provider-id">{providerConfig.id}</output>
      <output aria-label="persisted-headers">{JSON.stringify(providerConfig.headers ?? null)}</output>
    </>
  )
}

describe("providerHeadersField", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("renders the provider default headers as the placeholder when available", () => {
    render(<ProviderHeadersFieldHarness initialConfig={{ ...anthropicProviderConfig, headers: undefined }} />)

    expect(screen.getByLabelText("provider-headers-editor")).toHaveAttribute(
      "placeholder",
      JSON.stringify({ "anthropic-dangerous-direct-browser-access": "true" }, null, 2),
    )
  })

  it("saves valid header JSON", async () => {
    render(<ProviderHeadersFieldHarness initialConfig={baseProviderConfig} />)

    fireEvent.change(screen.getByLabelText("provider-headers-editor"), {
      target: {
        value: JSON.stringify({
          "HTTP-Referer": "https://example.com",
          "X-Title": "Read Frog",
        }),
      },
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(screen.getByLabelText("persisted-headers")).toHaveTextContent(
      JSON.stringify({
        "HTTP-Referer": "https://example.com",
        "X-Title": "Read Frog",
      }),
    )
  })

  it("keeps an explicit empty object as a saved override", async () => {
    render(<ProviderHeadersFieldHarness initialConfig={baseProviderConfig} />)

    fireEvent.change(screen.getByLabelText("provider-headers-editor"), {
      target: { value: "{}" },
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(screen.getByLabelText("persisted-headers")).toHaveTextContent("{}")
  })

  it("shows a validation error and does not save malformed JSON", async () => {
    render(<ProviderHeadersFieldHarness initialConfig={baseProviderConfig} />)

    fireEvent.change(screen.getByLabelText("provider-headers-editor"), {
      target: { value: "{" },
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(screen.getByText("options.apiProviders.form.invalidJson")).toBeInTheDocument()
    expect(screen.getByLabelText("persisted-headers")).toHaveTextContent("null")
  })

  it("rejects non-object header JSON", async () => {
    render(<ProviderHeadersFieldHarness initialConfig={baseProviderConfig} />)

    fireEvent.change(screen.getByLabelText("provider-headers-editor"), {
      target: { value: "[]" },
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(screen.getByText("options.apiProviders.form.invalidJson")).toBeInTheDocument()
    expect(screen.getByLabelText("persisted-headers")).toHaveTextContent("null")
  })

  it("rejects header JSON with non-string values", async () => {
    render(<ProviderHeadersFieldHarness initialConfig={baseProviderConfig} />)

    fireEvent.change(screen.getByLabelText("provider-headers-editor"), {
      target: { value: JSON.stringify({ "X-Count": 1 }) },
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(screen.getByText("options.apiProviders.form.invalidJson")).toBeInTheDocument()
    expect(screen.getByLabelText("persisted-headers")).toHaveTextContent("null")
  })

  it("does not submit stale debounced headers when switching providers", async () => {
    render(<ProviderHeadersFieldSwitchHarness />)

    fireEvent.change(screen.getByLabelText("provider-headers-editor"), {
      target: { value: JSON.stringify({ "X-Title": "Read Frog" }) },
    })

    fireEvent.click(screen.getByRole("button", { name: "switch-provider" }))

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(screen.getByLabelText("persisted-provider-id")).toHaveTextContent("provider-2")
    expect(screen.getByLabelText("persisted-headers")).toHaveTextContent(JSON.stringify({ Existing: "1" }))
  })
})
