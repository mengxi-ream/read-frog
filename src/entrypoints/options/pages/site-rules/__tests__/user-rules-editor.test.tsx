// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { UserRulesEditor } from "../user-rules-editor"

vi.mock("@/components/ui/json-code-editor", () => ({
  JSONCodeEditor: (props: {
    value?: string
    onChange?: (value: string) => void
    "aria-label"?: string
  }) => (
    <textarea
      aria-label={props["aria-label"]}
      value={props.value}
      onChange={(event) => props.onChange?.(event.target.value)}
    />
  ),
}))

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config)) as Config
}

function renderEditor() {
  const store = createStore()
  store.set(configAtom, cloneConfig(DEFAULT_CONFIG))

  render(
    <Provider store={store}>
      <UserRulesEditor />
    </Provider>,
  )

  return store
}

async function advanceDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(500)
    await Promise.resolve()
  })
}

describe("userRulesEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("shows validation issues and disables save for invalid JSON", async () => {
    renderEditor()

    fireEvent.change(screen.getByLabelText("site-rules-user-rules-editor"), {
      target: { value: "{" },
    })

    await advanceDebounce()

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("options.siteRules.userRules.validation.syntaxError")
    expect(alert.querySelector("code")).toHaveTextContent("rules")
    expect(
      screen.getByRole("button", { name: "options.siteRules.userRules.saveButton" }),
    ).toBeDisabled()
  })

  it("shows schema issues with formatted paths", async () => {
    renderEditor()

    fireEvent.change(screen.getByLabelText("site-rules-user-rules-editor"), {
      target: {
        value: JSON.stringify([
          { id: "ok", matches: "example.com" },
          { id: "bad", matches: 42 },
        ]),
      },
    })

    await advanceDebounce()

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("options.siteRules.userRules.validation.schemaErrors")
    expect(alert.querySelector("code")).toHaveTextContent("rules[1].matches")
    expect(
      screen.getByRole("button", { name: "options.siteRules.userRules.saveButton" }),
    ).toBeDisabled()
  })

  it("persists parsed rules to the store on save", async () => {
    const store = renderEditor()
    const rules = [{ id: "my-rule", matches: "example.com" }]

    fireEvent.change(screen.getByLabelText("site-rules-user-rules-editor"), {
      target: { value: JSON.stringify(rules) },
    })

    await advanceDebounce()

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    const saveButton = screen.getByRole("button", {
      name: "options.siteRules.userRules.saveButton",
    })
    expect(saveButton).toBeEnabled()

    await act(async () => {
      fireEvent.click(saveButton)
      await Promise.resolve()
    })

    expect(store.get(configAtom).siteRules.userRules).toEqual(rules)
    expect(store.get(configAtom).siteRules.disabledBuiltInRules).toEqual([])
    expect(
      screen.getByRole("button", { name: "options.siteRules.userRules.savedButton" }),
    ).toBeDisabled()
  })

  it("saves pasted legacy selector fields using canonical names", async () => {
    const store = renderEditor()
    const legacyRules = [
      {
        id: "legacy",
        matches: "example.com",
        forceBlockSelectors: [".block"],
        forceInlineSelectors: [".inline"],
      },
    ]
    const canonicalRules = [
      {
        id: "legacy",
        matches: "example.com",
        forceBlockNodeSelectors: [".block"],
        forceBlockStyleSelectors: [".block"],
        forceInlineStyleSelectors: [".inline"],
      },
    ]
    const editor = screen.getByLabelText("site-rules-user-rules-editor")

    fireEvent.change(editor, {
      target: { value: JSON.stringify(legacyRules) },
    })

    await advanceDebounce()

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    const saveButton = screen.getByRole("button", {
      name: "options.siteRules.userRules.saveButton",
    })
    expect(saveButton).toBeEnabled()

    await act(async () => {
      fireEvent.click(saveButton)
      await Promise.resolve()
    })

    expect(store.get(configAtom).siteRules.userRules).toEqual(canonicalRules)
    expect(editor).toHaveValue(JSON.stringify(canonicalRules, null, 2))
    expect(editor).not.toHaveValue(expect.stringContaining("forceBlockSelectors"))
    expect(editor).not.toHaveValue(expect.stringContaining("forceInlineSelectors"))
  })
})
