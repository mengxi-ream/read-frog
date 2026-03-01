// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { SelectionToolbarCustomFeature } from "@/types/config/selection-toolbar"
import { render, screen, waitFor } from "@testing-library/react"
import { atom, createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  activeCustomFeatureIdAtom,
  isCustomFeaturePopoverVisibleAtom,
  mouseClickPositionAtom,
  selectionContentAtom,
  selectionRangeAtom,
} from "../atom"
import { SelectionToolbarCustomFeaturePopover } from "../custom-feature-button"

const mockedAtoms = vi.hoisted(() => ({
  languageAtom: null as any,
  providersConfigAtom: null as any,
  selectionToolbarAtom: null as any,
}))

const mockedDeps = vi.hoisted(() => ({
  streamBackgroundStructuredObject: vi.fn(),
}))

vi.mock("@/utils/atoms/config", () => {
  const selectionToolbarAtom = atom({ customFeatures: [] as SelectionToolbarCustomFeature[] })
  const providersConfigAtom = atom([] as any[])
  const languageAtom = atom({ targetCode: "en" })

  mockedAtoms.selectionToolbarAtom = selectionToolbarAtom
  mockedAtoms.providersConfigAtom = providersConfigAtom
  mockedAtoms.languageAtom = languageAtom

  return {
    configFieldsAtomMap: {
      language: languageAtom,
      providersConfig: providersConfigAtom,
      selectionToolbar: selectionToolbarAtom,
    },
  }
})

vi.mock("@/utils/content-script/background-stream-client", () => ({
  streamBackgroundStructuredObject: mockedDeps.streamBackgroundStructuredObject,
}))

vi.mock("@/utils/providers/model", () => ({
  resolveModelId: vi.fn(() => "gpt-4o-mini"),
}))

vi.mock("@/utils/providers/options", () => ({
  getProviderOptionsWithOverride: vi.fn(() => ({})),
}))

vi.mock("../components/popover-wrapper", () => ({
  PopoverWrapper: ({ children, isVisible }: { children: ReactNode, isVisible: boolean }) =>
    (isVisible ? <div data-testid="custom-feature-popover">{children}</div> : null),
}))

vi.mock("../structured-object-renderer", () => ({
  StructuredObjectRenderer: () => <div data-testid="structured-object-renderer" />,
}))

const testFeature: SelectionToolbarCustomFeature = {
  id: "feature-1",
  name: "Dictionary",
  enabled: true,
  icon: "tabler:book-2",
  providerId: "provider-1",
  systemPrompt: "system={{context}}",
  prompt: "selection={{selection}}|context={{context}}",
  outputSchema: [
    {
      id: "field-1",
      name: "Definition",
      type: "string",
    },
  ],
}

const testProviderConfig = {
  id: "provider-1",
  name: "OpenAI",
  enabled: true,
  provider: "openai",
  model: {
    model: "gpt-4o-mini",
    isCustomModel: false,
    customModel: null,
  },
  providerOptions: {},
  temperature: 0.2,
}

function createSelectionRangeWithParagraph(paragraphText: string, selectedText: string) {
  document.body.innerHTML = `
    <article>
      <p id="paragraph">
        ${paragraphText}
        <strong id="selection">${selectedText}</strong>
        gamma
      </p>
    </article>
  `

  const selectionNode = document.getElementById("selection")?.firstChild
  if (!selectionNode) {
    throw new Error("selection node not found")
  }

  const range = document.createRange()
  range.setStart(selectionNode, 0)
  range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)
  return range
}

function renderPopover({ selectionContent, selectionRange }: { selectionContent: string, selectionRange: Range | null }) {
  const store = createStore()

  store.set(mockedAtoms.selectionToolbarAtom, { customFeatures: [testFeature] })
  store.set(mockedAtoms.providersConfigAtom, [testProviderConfig])
  store.set(mockedAtoms.languageAtom, { targetCode: "en" })

  store.set(selectionContentAtom, selectionContent)
  store.set(selectionRangeAtom, selectionRange)
  store.set(isCustomFeaturePopoverVisibleAtom, true)
  store.set(activeCustomFeatureIdAtom, testFeature.id)
  store.set(mouseClickPositionAtom, { x: 100, y: 100 })

  return render(
    <Provider store={store}>
      <SelectionToolbarCustomFeaturePopover />
    </Provider>,
  )
}

describe("selectionToolbar custom feature popover", () => {
  afterEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("shows Selection and Paragraph, and sends paragraph text as context", async () => {
    mockedDeps.streamBackgroundStructuredObject.mockResolvedValue({ Definition: "value" })
    const selectionRange = createSelectionRangeWithParagraph("Alpha", "Beta")

    renderPopover({
      selectionContent: "Beta",
      selectionRange,
    })

    await waitFor(() => {
      expect(mockedDeps.streamBackgroundStructuredObject).toHaveBeenCalledTimes(1)
    })

    const selectionLabel = screen.getByText("Selection")
    const selectionValue = selectionLabel.nextElementSibling as HTMLElement | null
    const paragraphLabel = screen.getByText("Paragraph")
    const paragraphValue = paragraphLabel.nextElementSibling as HTMLElement | null

    expect(selectionValue).toHaveTextContent("Beta")
    expect(paragraphValue).toHaveTextContent("Alpha Beta gamma")

    const requestPayload = mockedDeps.streamBackgroundStructuredObject.mock.calls[0]?.[0]
    expect(requestPayload?.prompt).toBe("selection=Beta|context=Alpha Beta gamma")
    expect(requestPayload?.system).toBe("system=Alpha Beta gamma")
  })

  it("falls back to selection text for paragraph and context when range is missing", async () => {
    mockedDeps.streamBackgroundStructuredObject.mockResolvedValue({ Definition: "value" })

    renderPopover({
      selectionContent: "Beta",
      selectionRange: null,
    })

    await waitFor(() => {
      expect(mockedDeps.streamBackgroundStructuredObject).toHaveBeenCalledTimes(1)
    })

    const selectionLabel = screen.getByText("Selection")
    const selectionValue = selectionLabel.nextElementSibling as HTMLElement | null
    const paragraphLabel = screen.getByText("Paragraph")
    const paragraphValue = paragraphLabel.nextElementSibling as HTMLElement | null

    expect(selectionValue).toHaveTextContent("Beta")
    expect(paragraphValue).toHaveTextContent("Beta")

    const requestPayload = mockedDeps.streamBackgroundStructuredObject.mock.calls[0]?.[0]
    expect(requestPayload?.prompt).toBe("selection=Beta|context=Beta")
    expect(requestPayload?.system).toBe("system=Beta")
  })
})
