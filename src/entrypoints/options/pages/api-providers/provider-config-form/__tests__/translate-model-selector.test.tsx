// @vitest-environment jsdom
import type { APIProviderConfig } from "@/types/config/provider"
import { useStore } from "@tanstack/react-form"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useEffect, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { formOpts, useAppForm } from "../form"
import { TranslateModelSelector } from "../translate-model-selector"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("../components/provider-options-recommendation-trigger", () => ({
  ProviderOptionsRecommendationTrigger: ({
    currentProviderOptions,
    onApply,
  }: {
    currentProviderOptions?: Record<string, unknown>
    onApply: (options: Record<string, unknown>) => void
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onApply({ reasoningEffort: "minimal" })}
      >
        apply-recommendation
      </button>
      <output aria-label="current-provider-options-prop">
        {JSON.stringify(currentProviderOptions ?? null)}
      </output>
    </div>
  ),
}))

const duplicateProviderName = "Duplicate provider"

const baseProviderConfig: APIProviderConfig = {
  id: "provider-1",
  name: "OpenAI",
  enabled: true,
  provider: "openai",
  model: {
    model: "gpt-5-mini",
    isCustomModel: true,
    customModel: "gpt-5-mini",
  },
  providerOptions: undefined,
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve()
  })
}

function TranslateModelSelectorHarness({
  initialConfig = baseProviderConfig,
}: {
  initialConfig?: APIProviderConfig
}) {
  const [providerConfig, setProviderConfig] = useState(initialConfig)
  const [submitCount, setSubmitCount] = useState(0)
  const form = useAppForm({
    ...formOpts,
    defaultValues: providerConfig,
    onSubmit: async ({ value }) => {
      setSubmitCount(count => count + 1)
      setProviderConfig(value)
    },
  })
  const formValues = useStore(form.store, state => state.values)

  useEffect(() => {
    form.reset(providerConfig)
  }, [providerConfig, form])

  return (
    <form.AppForm>
      <form.AppField
        name="name"
        validators={{
          onChange: ({ value }) => value === duplicateProviderName ? "Duplicate provider name" : undefined,
        }}
      >
        {field => (
          <input
            aria-label="provider-name"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => {
              field.handleChange(event.target.value)
              void form.handleSubmit()
            }}
          />
        )}
      </form.AppField>
      <TranslateModelSelector form={form} />
      <output aria-label="form-name">{formValues.name}</output>
      <output aria-label="form-provider-options">{JSON.stringify(formValues.providerOptions ?? null)}</output>
      <output aria-label="persisted-name">{providerConfig.name}</output>
      <output aria-label="persisted-provider-options">{JSON.stringify(providerConfig.providerOptions ?? null)}</output>
      <output aria-label="submit-count">{String(submitCount)}</output>
    </form.AppForm>
  )
}

describe("translateModelSelector", () => {
  it("keeps invalid form values while staging recommended provider options", async () => {
    render(<TranslateModelSelectorHarness />)

    fireEvent.change(screen.getByLabelText("provider-name"), {
      target: { value: duplicateProviderName },
    })
    await flushUpdates()

    fireEvent.click(screen.getByRole("button", { name: "apply-recommendation" }))
    await flushUpdates()

    expect(screen.getByLabelText("provider-name")).toHaveValue(duplicateProviderName)
    expect(screen.getByLabelText("form-name")).toHaveTextContent(duplicateProviderName)
    expect(screen.getByLabelText("persisted-name")).toHaveTextContent("OpenAI")
    expect(screen.getByLabelText("form-provider-options")).toHaveTextContent("{\"reasoningEffort\":\"minimal\"}")
    expect(screen.getByLabelText("current-provider-options-prop")).toHaveTextContent("{\"reasoningEffort\":\"minimal\"}")
    expect(screen.getByLabelText("persisted-provider-options")).toHaveTextContent("null")
    expect(screen.getByLabelText("submit-count")).toHaveTextContent("0")
  })

  it("persists staged recommendations after the validation error is fixed", async () => {
    render(<TranslateModelSelectorHarness />)

    fireEvent.change(screen.getByLabelText("provider-name"), {
      target: { value: duplicateProviderName },
    })
    await flushUpdates()

    fireEvent.click(screen.getByRole("button", { name: "apply-recommendation" }))
    await flushUpdates()

    fireEvent.change(screen.getByLabelText("provider-name"), {
      target: { value: "OpenAI Saved" },
    })
    await flushUpdates()

    expect(screen.getByLabelText("persisted-name")).toHaveTextContent("OpenAI Saved")
    expect(screen.getByLabelText("persisted-provider-options")).toHaveTextContent("{\"reasoningEffort\":\"minimal\"}")
    expect(screen.getByLabelText("submit-count")).toHaveTextContent("1")
  })

  it("submits recommendations immediately when the form is valid", async () => {
    render(<TranslateModelSelectorHarness />)

    fireEvent.click(screen.getByRole("button", { name: "apply-recommendation" }))
    await flushUpdates()

    expect(screen.getByLabelText("persisted-name")).toHaveTextContent("OpenAI")
    expect(screen.getByLabelText("persisted-provider-options")).toHaveTextContent("{\"reasoningEffort\":\"minimal\"}")
    expect(screen.getByLabelText("submit-count")).toHaveTextContent("1")
  })
})
