// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { BuiltInRules } from "../built-in-rules"

vi.mock("@/utils/site-rules/built-in", () => ({
  BUILT_IN_SITE_RULES: [
    {
      id: "rule-github",
      description: "GitHub tweaks",
      matches: ["github.com", "gist.github.com", "*.githubusercontent.com"],
    },
    { id: "rule-reddit", description: "Reddit", matches: "reddit.com" },
    { id: "rule-wiki", matches: "wikipedia.org" },
  ],
}))

const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText },
})

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config)) as Config
}

function renderBuiltInRules() {
  const store = createStore()
  store.set(configAtom, cloneConfig(DEFAULT_CONFIG))

  render(
    <Provider store={store}>
      <BuiltInRules />
    </Provider>,
  )

  return store
}

describe("builtInRules", () => {
  beforeEach(() => {
    writeText.mockClear()
  })

  it("filters rows by id, description, and matches substring", () => {
    renderBuiltInRules()

    expect(screen.getAllByRole("switch")).toHaveLength(3)

    const searchInput = screen.getByPlaceholderText("options.siteRules.builtIn.searchPlaceholder")

    // Matches by description, case-insensitive
    fireEvent.change(searchInput, { target: { value: "REDDIT" } })
    expect(screen.getAllByRole("switch")).toHaveLength(1)
    expect(screen.getByText("rule-reddit")).toBeInTheDocument()
    expect(screen.queryByText("rule-github")).not.toBeInTheDocument()

    // Matches by URL pattern substring
    fireEvent.change(searchInput, { target: { value: "githubusercontent" } })
    expect(screen.getAllByRole("switch")).toHaveLength(1)
    expect(screen.getByText("rule-github")).toBeInTheDocument()

    // Matches by id
    fireEvent.change(searchInput, { target: { value: "rule-wiki" } })
    expect(screen.getAllByRole("switch")).toHaveLength(1)
    expect(screen.getByText("rule-wiki")).toBeInTheDocument()
  })

  it("toggles a rule id in and out of disabledBuiltInRules", async () => {
    const store = renderBuiltInRules()

    const ruleSwitch = screen.getByRole("switch", { name: "rule-github" })

    await act(async () => {
      fireEvent.click(ruleSwitch)
      await Promise.resolve()
    })
    expect(store.get(configAtom).siteRules.disabledBuiltInRules).toEqual(["rule-github"])

    await act(async () => {
      fireEvent.click(ruleSwitch)
      await Promise.resolve()
    })
    expect(store.get(configAtom).siteRules.disabledBuiltInRules).toEqual([])
  })

  it("copies the rule as pretty-printed JSON", async () => {
    renderBuiltInRules()

    const copyButtons = screen.getAllByRole("button", { name: "action.copy" })

    await act(async () => {
      fireEvent.click(copyButtons[0])
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith(
      JSON.stringify(
        {
          id: "rule-github",
          description: "GitHub tweaks",
          matches: ["github.com", "gist.github.com", "*.githubusercontent.com"],
        },
        null,
        2,
      ),
    )
    expect(screen.getByRole("button", { name: "action.copied" })).toBeInTheDocument()
  })
})
