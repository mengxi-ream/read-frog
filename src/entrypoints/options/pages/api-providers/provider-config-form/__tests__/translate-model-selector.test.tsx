// @vitest-environment jsdom
import type { APIProviderConfig } from "@/types/config/provider"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useSelector } from "@tanstack/react-store"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { type ReactNode, useEffect, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { formOpts, useAppForm } from "../form"
import { TranslateModelSelector } from "../translate-model-selector"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/components/ui/base-ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: ReactNode
    onValueChange?: (value: string) => void
    value?: string
  }) => (
    <select
      aria-label="model-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}))

vi.mock("../components/model-suggestion-button", () => ({
  ModelSuggestionButton: ({ onSelect }: { onSelect: (model: string) => void }) => (
    <div>
      <button type="button" onClick={() => onSelect("gpt-4o")}>
        suggest-known-model
      </button>
      <button type="button" onClick={() => onSelect("brand-new-model")}>
        suggest-unknown-model
      </button>
    </div>
  ),
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
      <button type="button" onClick={() => onApply({ reasoningEffort: "minimal" })}>
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

const customProviderConfig: APIProviderConfig = {
  id: "custom-provider",
  name: "Custom",
  enabled: true,
  provider: "openai-compatible",
  baseURL: "http://localhost:11434/v1",
  model: {
    model: "use-custom-model",
    isCustomModel: true,
    customModel: "local-model",
  },
}

const deepInfraProviderConfig: APIProviderConfig = {
  id: "deepinfra-default",
  name: "DeepInfra",
  enabled: true,
  provider: "deepinfra",
  model: {
    model: "meta-llama/Llama-3.3-70B-Instruct",
    isCustomModel: false,
    customModel: null,
  },
}

const openRouterProviderConfig: APIProviderConfig = {
  id: "openrouter-default",
  name: "OpenRouter",
  enabled: true,
  provider: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  model: {
    model: "x-ai/grok-4-fast:free",
    isCustomModel: false,
    customModel: null,
  },
}

const googleProviderConfig: APIProviderConfig = {
  id: "google-default",
  name: "Google",
  enabled: true,
  provider: "google",
  apiKey: "",
  model: {
    model: "gemini-flash-lite-latest",
    isCustomModel: false,
    customModel: null,
  },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
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
      setSubmitCount((count) => count + 1)
      setProviderConfig(value)
    },
  })
  const formValues = useSelector(form.store, (state) => state.values)

  useEffect(() => {
    form.reset(providerConfig)
  }, [providerConfig, form])

  return (
    <form.AppForm>
      <form.AppField
        name="name"
        validators={{
          onChange: ({ value }) =>
            value === duplicateProviderName ? "Duplicate provider name" : undefined,
        }}
      >
        {(field) => (
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
      <form.AppField name="apiKey">
        {(field) => (
          <input
            aria-label="api-key"
            value={field.state.value ?? ""}
            onChange={(event) => {
              field.handleChange(event.target.value)
              void form.handleSubmit()
            }}
          />
        )}
      </form.AppField>
      <TranslateModelSelector form={form} />
      <output aria-label="form-name">{formValues.name}</output>
      <output aria-label="form-provider-options">
        {JSON.stringify(formValues.providerOptions ?? null)}
      </output>
      <output aria-label="persisted-name">{providerConfig.name}</output>
      <output aria-label="persisted-provider-options">
        {JSON.stringify(providerConfig.providerOptions ?? null)}
      </output>
      <output aria-label="persisted-model">
        {JSON.stringify("model" in providerConfig ? providerConfig.model : null)}
      </output>
      <output aria-label="submit-count">{String(submitCount)}</output>
    </form.AppForm>
  )
}

function renderSelector(initialConfig?: APIProviderConfig) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TranslateModelSelectorHarness initialConfig={initialConfig} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("translateModelSelector", () => {
  it("keeps invalid form values while staging recommended provider options", async () => {
    renderSelector()

    fireEvent.change(screen.getByLabelText("provider-name"), {
      target: { value: duplicateProviderName },
    })
    await flushUpdates()

    fireEvent.click(screen.getByRole("button", { name: "apply-recommendation" }))
    await flushUpdates()

    expect(screen.getByLabelText("provider-name")).toHaveValue(duplicateProviderName)
    expect(screen.getByLabelText("form-name")).toHaveTextContent(duplicateProviderName)
    expect(screen.getByLabelText("persisted-name")).toHaveTextContent("OpenAI")
    expect(screen.getByLabelText("form-provider-options")).toHaveTextContent(
      '{"reasoningEffort":"minimal"}',
    )
    expect(screen.getByLabelText("current-provider-options-prop")).toHaveTextContent(
      '{"reasoningEffort":"minimal"}',
    )
    expect(screen.getByLabelText("persisted-provider-options")).toHaveTextContent("null")
    expect(screen.getByLabelText("submit-count")).toHaveTextContent("0")
  })

  it("persists staged recommendations after the validation error is fixed", async () => {
    renderSelector()

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
    expect(screen.getByLabelText("persisted-provider-options")).toHaveTextContent(
      '{"reasoningEffort":"minimal"}',
    )
    expect(screen.getByLabelText("submit-count")).toHaveTextContent("1")
  })

  it("updates the custom model from a discovered suggestion", async () => {
    renderSelector(customProviderConfig)

    fireEvent.click(screen.getByRole("button", { name: "suggest-unknown-model" }))
    await flushUpdates()

    expect(screen.getByLabelText("persisted-model")).toHaveTextContent(
      JSON.stringify({
        model: "use-custom-model",
        isCustomModel: true,
        customModel: "brand-new-model",
      }),
    )
  })

  it("selects a known model through the unchanged static model path", async () => {
    renderSelector({
      ...baseProviderConfig,
      model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
    })

    fireEvent.change(screen.getByLabelText("model-select"), { target: { value: "gpt-4o" } })
    await flushUpdates()

    expect(screen.getByLabelText("persisted-model")).toHaveTextContent(
      JSON.stringify({ model: "gpt-4o", isCustomModel: false, customModel: null }),
    )
  })

  it("loads public models automatically and routes a discovered id through custom model storage", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [
          { id: "new-chat-model", metadata: { tags: ["chat"] } },
          { id: "another-chat-model", metadata: { tags: ["chat"] } },
          { id: "image-model", metadata: { tags: ["image-gen"] } },
        ],
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    renderSelector(deepInfraProviderConfig)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("https://api.deepinfra.com/v1/openai/models", {
        headers: {},
        signal: expect.any(AbortSignal),
      })
    })
    expect(await screen.findByRole("option", { name: "new-chat-model" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "image-model" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "suggest-unknown-model" })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("model-select"), {
      target: { value: "new-chat-model" },
    })
    await flushUpdates()

    expect(screen.getByLabelText("persisted-model")).toHaveTextContent(
      JSON.stringify({
        model: "meta-llama/Llama-3.3-70B-Instruct",
        isCustomModel: true,
        customModel: "new-chat-model",
      }),
    )

    expect(screen.getByLabelText("model-select")).toHaveValue("new-chat-model")
    expect(screen.getByRole("option", { name: "another-chat-model" })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("model-select"), {
      target: { value: "another-chat-model" },
    })
    await flushUpdates()

    expect(screen.getByLabelText("persisted-model")).toHaveTextContent(
      JSON.stringify({
        model: "meta-llama/Llama-3.3-70B-Instruct",
        isCustomModel: true,
        customModel: "another-chat-model",
      }),
    )

    fireEvent.change(screen.getByLabelText("model-select"), {
      target: { value: "meta-llama/Llama-3.3-70B-Instruct" },
    })
    await flushUpdates()

    expect(screen.getByLabelText("persisted-model")).toHaveTextContent(
      JSON.stringify({
        model: "meta-llama/Llama-3.3-70B-Instruct",
        isCustomModel: false,
        customModel: null,
      }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("keeps the static dropdown for named custom providers and discovers their models", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: [{ id: "openrouter/new-model" }] }))
    vi.stubGlobal("fetch", fetchMock)

    renderSelector(openRouterProviderConfig)

    expect(screen.getByLabelText("model-select")).toHaveValue("x-ai/grok-4-fast:free")
    expect(document.getElementById("model.customModel")).not.toBeInTheDocument()

    expect(await screen.findByRole("option", { name: "openrouter/new-model" })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("model-select"), {
      target: { value: "openrouter/new-model" },
    })
    await flushUpdates()

    expect(screen.getByLabelText("persisted-model")).toHaveTextContent(
      JSON.stringify({
        model: "x-ai/grok-4-fast:free",
        isCustomModel: true,
        customModel: "openrouter/new-model",
      }),
    )
  })

  it("keeps an existing discovered custom id in the automatic model selector", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ data: [{ id: "new-chat-model", metadata: { tags: ["chat"] } }] }),
      )
    vi.stubGlobal("fetch", fetchMock)

    renderSelector({
      ...deepInfraProviderConfig,
      model: {
        model: "meta-llama/Llama-3.3-70B-Instruct",
        isCustomModel: true,
        customModel: "new-chat-model",
      },
    })

    expect(screen.getByLabelText("model-select")).toHaveValue("new-chat-model")
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole("option", { name: "new-chat-model" })).toBeInTheDocument()
  })

  it("preserves a discovered selection when manual model entry is opened and closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ data: [{ id: "new-chat-model", metadata: { tags: ["chat"] } }] }),
        ),
    )
    renderSelector(deepInfraProviderConfig)

    expect(await screen.findByRole("option", { name: "new-chat-model" })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("model-select"), {
      target: { value: "new-chat-model" },
    })
    await flushUpdates()

    fireEvent.click(screen.getByRole("checkbox"))
    expect(document.getElementById("model.customModel")).toHaveValue("new-chat-model")

    fireEvent.click(screen.getByRole("checkbox"))
    expect(screen.getByLabelText("model-select")).toHaveValue("new-chat-model")
    expect(screen.getByLabelText("persisted-model")).toHaveTextContent(
      JSON.stringify({
        model: "meta-llama/Llama-3.3-70B-Instruct",
        isCustomModel: true,
        customModel: "new-chat-model",
      }),
    )
  })

  it("restores the static model when manual model entry is cleared", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ data: [{ id: "new-chat-model", metadata: { tags: ["chat"] } }] }),
        ),
    )
    renderSelector(deepInfraProviderConfig)

    expect(await screen.findByRole("option", { name: "new-chat-model" })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("model-select"), {
      target: { value: "new-chat-model" },
    })
    await flushUpdates()

    fireEvent.click(screen.getByRole("checkbox"))
    const customModelInput = document.getElementById("model.customModel")
    expect(customModelInput).toHaveValue("new-chat-model")
    fireEvent.change(customModelInput!, { target: { value: "" } })
    await flushUpdates()

    fireEvent.click(screen.getByRole("checkbox"))
    await flushUpdates()
    expect(screen.getByLabelText("model-select")).toHaveValue("meta-llama/Llama-3.3-70B-Instruct")
    expect(screen.getByLabelText("persisted-model")).toHaveTextContent(
      JSON.stringify({
        model: "meta-llama/Llama-3.3-70B-Instruct",
        isCustomModel: false,
        customModel: null,
      }),
    )
  })

  it("debounces and trims an API key before authenticated discovery", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        models: [
          {
            name: "models/gemini-future-flash",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
    renderSelector(googleProviderConfig)

    const apiKeyInput = screen.getByLabelText("api-key")
    fireEvent.change(apiKeyInput, { target: { value: " goog" } })
    fireEvent.change(apiKeyInput, { target: { value: " goog-key" } })
    fireEvent.change(apiKeyInput, { target: { value: " goog-key " } })

    expect(fetchMock).not.toHaveBeenCalled()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 1_500 })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("generativelanguage.googleapis.com/v1beta/models"),
      {
        headers: { "x-goog-api-key": "goog-key" },
        signal: expect.any(AbortSignal),
      },
    )
    expect(await screen.findByRole("option", { name: "gemini-future-flash" })).toBeInTheDocument()
  })

  it("keeps static options when automatic discovery fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: "failed" }, 403))
    vi.stubGlobal("fetch", fetchMock)
    renderSelector(deepInfraProviderConfig)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(
      screen.getByRole("option", { name: "meta-llama/Llama-3.3-70B-Instruct" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("model-select")).toHaveValue("meta-llama/Llama-3.3-70B-Instruct")
  })

  it("submits recommendations immediately when the form is valid", async () => {
    renderSelector()

    fireEvent.click(screen.getByRole("button", { name: "apply-recommendation" }))
    await flushUpdates()

    expect(screen.getByLabelText("persisted-name")).toHaveTextContent("OpenAI")
    expect(screen.getByLabelText("persisted-provider-options")).toHaveTextContent(
      '{"reasoningEffort":"minimal"}',
    )
    expect(screen.getByLabelText("submit-count")).toHaveTextContent("1")
  })
})
