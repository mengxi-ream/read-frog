// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { selectedProviderIdsAtom, translationCardExpandedStateAtom } from "../../atoms"
import { TranslationPanel } from "../translation-panel"
import { TranslationPanelActions } from "../translation-panel-actions"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("../translation-card", () => ({
  TranslationCard: ({ providerId, isExpanded, onExpandedChange }: { providerId: string, isExpanded: boolean, onExpandedChange: (expanded: boolean) => void }) => (
    <div data-testid={`card-${providerId}`} data-expanded={String(isExpanded)}>
      <span>
        {providerId}
      </span>
      <button type="button" onClick={() => onExpandedChange(!isExpanded)}>
        toggle-
        {providerId}
      </button>
    </div>
  ),
}))

function renderTranslationPanel(options?: { selectedProviderIds?: string[], expandedById?: Record<string, boolean> }) {
  const store = createStore()

  store.set(selectedProviderIdsAtom, options?.selectedProviderIds ?? ["provider-a", "provider-b"])
  store.set(translationCardExpandedStateAtom, options?.expandedById ?? {})

  return {
    store,
    ...render(
      <Provider store={store}>
        <TranslationPanelActions />
        <TranslationPanel />
      </Provider>,
    ),
  }
}

describe("translationPanel", () => {
  it("collapses and expands all selected cards", () => {
    renderTranslationPanel()

    expect(screen.getByTestId("card-provider-a")).toHaveAttribute("data-expanded", "true")
    expect(screen.getByTestId("card-provider-b")).toHaveAttribute("data-expanded", "true")

    fireEvent.click(screen.getByRole("button", { name: "translationHub.collapseAllCards" }))

    expect(screen.getByTestId("card-provider-a")).toHaveAttribute("data-expanded", "false")
    expect(screen.getByTestId("card-provider-b")).toHaveAttribute("data-expanded", "false")

    fireEvent.click(screen.getByRole("button", { name: "translationHub.expandAllCards" }))

    expect(screen.getByTestId("card-provider-a")).toHaveAttribute("data-expanded", "true")
    expect(screen.getByTestId("card-provider-b")).toHaveAttribute("data-expanded", "true")
  })

  it("toggles a single card without affecting other cards", () => {
    renderTranslationPanel()

    fireEvent.click(screen.getByRole("button", { name: /toggle-\s*provider-a/ }))

    expect(screen.getByTestId("card-provider-a")).toHaveAttribute("data-expanded", "false")
    expect(screen.getByTestId("card-provider-b")).toHaveAttribute("data-expanded", "true")
  })
})
