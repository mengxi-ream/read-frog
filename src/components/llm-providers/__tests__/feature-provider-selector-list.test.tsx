// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { FeatureProviderSelectorList } from "@/components/llm-providers/feature-provider-selector-list"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

// Keep the render shallow — we only care about which custom-action rows appear,
// not the provider dropdown internals.
vi.mock("@/components/llm-providers/provider-selector", () => ({
  default: () => <div>ProviderSelector</div>,
}))

type CustomAction = Config["selectionToolbar"]["customActions"][number]

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config)) as Config
}

function makeAction(
  action: Pick<CustomAction, "id" | "name" | "providerId"> & Partial<CustomAction>,
): CustomAction {
  return {
    icon: "tabler:sparkles",
    systemPrompt: "You are helpful.",
    prompt: "Do something.",
    outputSchema: [],
    ...action,
  }
}

function renderWithConfig(config: Config) {
  const store = createStore()
  store.set(configAtom, config)
  render(
    <Provider store={store}>
      <FeatureProviderSelectorList />
    </Provider>,
  )
}

describe("featureProviderSelectorList custom action filtering", () => {
  it("only renders provider rows for enabled custom actions", () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    const providerId = config.providersConfig[0].id

    config.selectionToolbar.customActions = [
      makeAction({ id: "enabled-action", name: "Enabled Action", providerId, enabled: true }),
      makeAction({ id: "disabled-action", name: "Disabled Action", providerId, enabled: false }),
    ]

    renderWithConfig(config)

    expect(screen.getByText("Enabled Action")).toBeInTheDocument()
    expect(screen.queryByText("Disabled Action")).not.toBeInTheDocument()
  })

  it("treats actions without an explicit enabled flag as enabled", () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    const providerId = config.providersConfig[0].id

    config.selectionToolbar.customActions = [
      makeAction({ id: "implicit-action", name: "Implicit Action", providerId }),
    ]

    renderWithConfig(config)

    expect(screen.getByText("Implicit Action")).toBeInTheDocument()
  })

  it("hides the custom actions section when every action is disabled", () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    const providerId = config.providersConfig[0].id

    config.selectionToolbar.customActions = [
      makeAction({ id: "disabled-action", name: "Disabled Action", providerId, enabled: false }),
    ]

    renderWithConfig(config)

    expect(screen.queryByText("Disabled Action")).not.toBeInTheDocument()
    expect(
      screen.queryByText("options.general.featureProviders.customActions"),
    ).not.toBeInTheDocument()
  })
})
