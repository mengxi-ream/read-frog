// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { ModelSuggestionButton } from "../model-suggestion-button"

describe("ModelSuggestionButton authentication", () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([undefined, "", "   ", "test-key"])(
    "fetches Bilibili models with optional key %j",
    async (apiKey) => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ data: [] })))
      vi.stubGlobal("fetch", fetchMock)
      render(
        <QueryClientProvider client={new QueryClient()}>
          <ModelSuggestionButton
            providerConfig={{ ...DEFAULT_PROVIDER_CONFIG["bilibili-translate"], apiKey }}
            onSelect={vi.fn<(model: string) => void>()}
          />
        </QueryClientProvider>,
      )
      fireEvent.click(screen.getByRole("button"))
      await screen.findByText("options.apiProviders.form.models.noModels")
      expect(fetchMock).toHaveBeenCalledWith("https://index-translate.bilibili.com/v1/models", {
        headers: apiKey?.trim() ? { Authorization: `Bearer ${apiKey}` } : {},
      })
    },
  )

  it("still requires a key for OpenAI-compatible providers", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ModelSuggestionButton
          providerConfig={{
            ...DEFAULT_PROVIDER_CONFIG["openai-compatible"],
            baseURL: "https://api.openai.com/v1",
            apiKey: "",
          }}
          onSelect={vi.fn<(model: string) => void>()}
        />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole("button"))
    await waitFor(() =>
      expect(screen.getByText("options.apiProviders.form.models.clickToRetry")).toBeInTheDocument(),
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
