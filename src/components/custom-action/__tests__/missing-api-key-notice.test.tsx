// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sendMessage } from "@/utils/message"
import { buildProviderConfigRoute } from "@/utils/navigation"
import { MissingApiKeyNotice } from "../missing-api-key-notice"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, args?: string[]) => (args ? `${key}(${args.join(",")})` : key),
  },
  initI18n: async () => {},
  setUiLanguage: async () => {},
}))

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn<(...args: any[]) => any>(),
}))

const ADD_API_KEY = "options.selectionToolbar.missingApiKey.addApiKey"
const apiKeyRoute = buildProviderConfigRoute("openai-default", { highlightApiKey: true })

describe("missingApiKeyNotice", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("renders nothing without a missing key", () => {
    const { container } = render(<MissingApiKeyNotice state={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("names the keyless provider over a Built-in AI answer and links to its key", () => {
    render(
      <MissingApiKeyNotice
        state={{ kind: "fallback", providerId: "openai-default", providerName: "OpenAI" }}
      />,
    )

    expect(screen.getByRole("status")).toHaveTextContent(
      "options.selectionToolbar.missingApiKey.fallbackNotice(OpenAI)",
    )
    fireEvent.click(screen.getByRole("button", { name: ADD_API_KEY }))
    expect(sendMessage).toHaveBeenCalledWith("openOptionsPage", { route: apiKeyRoute })
  })

  it("offers both the key and the Built-in AI's way in when neither can answer", () => {
    render(
      <MissingApiKeyNotice
        state={{
          kind: "blocked",
          providerId: "openai-default",
          providerName: "OpenAI",
          builtInAiAction: { label: "Log in", url: "https://readfrog.app/log-in" },
        }}
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "options.selectionToolbar.missingApiKey.title(OpenAI)",
    )
    fireEvent.click(screen.getByRole("button", { name: ADD_API_KEY }))
    expect(sendMessage).toHaveBeenCalledWith("openOptionsPage", { route: apiKeyRoute })

    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(sendMessage).toHaveBeenCalledWith("openPage", {
      url: "https://readfrog.app/log-in",
      active: true,
    })
  })
  it("offers only the key when no account change would help", () => {
    render(
      <MissingApiKeyNotice
        state={{
          kind: "blocked",
          providerId: "openai-default",
          providerName: "OpenAI",
          builtInAiAction: null,
        }}
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "options.selectionToolbar.missingApiKey.addKeyDescription",
    )
    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(screen.getByRole("button", { name: ADD_API_KEY })).toBeInTheDocument()
  })
})
