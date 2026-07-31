// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { MemoryRouter } from "react-router"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getBuiltInDictionaryAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { CustomActionCardList } from "../action-card-list"

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe("CustomActionCardList", () => {
  it("orders Add, custom actions, then the built-in Dictionary", () => {
    const store = createStore()
    const config = structuredClone(DEFAULT_CONFIG)
    const dictionary = getBuiltInDictionaryAction(config.selectionToolbar)
    config.selectionToolbar.customActions = [
      {
        ...dictionary,
        id: "custom-action",
        name: "Custom action",
      },
    ]
    store.set(configAtom, config)

    render(
      <Provider store={store}>
        <MemoryRouter>
          <CustomActionCardList />
        </MemoryRouter>
      </Provider>,
    )

    const addButton = screen.getByRole("button", {
      name: i18n.t("options.selectionToolbar.customActions.add"),
    })
    const customAction = screen.getByText("Custom action")
    const builtInDictionary = screen.getByText(dictionary.name)

    expect(screen.getByRole("switch", { name: "Custom action" })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: dictionary.name })).toBeInTheDocument()
    expect(
      addButton.compareDocumentPosition(customAction) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      customAction.compareDocumentPosition(builtInDictionary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
