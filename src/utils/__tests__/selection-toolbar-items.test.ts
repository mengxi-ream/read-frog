import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getBuiltInDictionaryAction } from "@/utils/custom-actions"
import {
  getSelectionToolbarItems,
  reorderSelectionToolbarItems,
  setSelectionToolbarCustomActions,
  setSelectionToolbarItemEnabled,
} from "@/utils/selection-toolbar-items"

function toolbarWith(customIds: string[] = [], order?: string[]) {
  const selectionToolbar = structuredClone(DEFAULT_CONFIG.selectionToolbar)
  const dictionary = getBuiltInDictionaryAction(selectionToolbar)
  selectionToolbar.customActions = customIds.map((id): SelectionToolbarCustomAction => ({
    ...dictionary,
    id,
    name: id,
  }))
  if (order) selectionToolbar.order = order
  return selectionToolbar
}

const idsOf = (selectionToolbar: ReturnType<typeof toolbarWith>) =>
  getSelectionToolbarItems(selectionToolbar).map((item) => item.id)

describe("getSelectionToolbarItems", () => {
  it("lists the features, built-in actions and custom actions in the default order", () => {
    expect(idsOf(toolbarWith(["a", "b"]))).toEqual([
      "translate",
      "speak",
      "default-dictionary",
      "default-sentence-analysis",
      "a",
      "b",
    ])
  })

  it("follows the saved order across features and actions", () => {
    const selectionToolbar = toolbarWith(
      ["a", "b"],
      ["b", "speak", "default-sentence-analysis", "translate", "a", "default-dictionary"],
    )
    expect(idsOf(selectionToolbar)).toEqual([
      "b",
      "speak",
      "default-sentence-analysis",
      "translate",
      "a",
      "default-dictionary",
    ])
  })

  it("puts items the order does not name after it, and skips ids no item has", () => {
    const selectionToolbar = toolbarWith(["a", "new"], ["a", "gone", "speak", "a"])
    expect(idsOf(selectionToolbar)).toEqual([
      "a",
      "speak",
      "translate",
      "default-dictionary",
      "default-sentence-analysis",
      "new",
    ])
  })

  it("reads each item's pin from its own enabled switch", () => {
    const selectionToolbar = toolbarWith(["a"])
    selectionToolbar.features.speak.enabled = false
    selectionToolbar.builtInActions.sentenceAnalysis.enabled = false
    selectionToolbar.customActions[0]!.enabled = false
    const pinned = Object.fromEntries(
      getSelectionToolbarItems(selectionToolbar).map((item) => [item.id, item.enabled]),
    )
    expect(pinned).toEqual({
      translate: true,
      speak: false,
      "default-dictionary": true,
      "default-sentence-analysis": false,
      a: false,
    })
  })
})

describe("reorderSelectionToolbarItems", () => {
  it("saves the new order and keeps the custom actions' own list in step", () => {
    const selectionToolbar = toolbarWith(["a", "b", "c"])
    const order = [
      "c",
      "translate",
      "a",
      "speak",
      "default-dictionary",
      "b",
      "default-sentence-analysis",
    ]
    const next = reorderSelectionToolbarItems(selectionToolbar, order)

    expect(next.order).toEqual(order)
    expect(next.customActions.map((action) => action.id)).toEqual(["c", "a", "b"])
    expect(idsOf(next)).toEqual(order)
    // The input is not touched.
    expect(selectionToolbar.customActions.map((action) => action.id)).toEqual(["a", "b", "c"])
  })
})

describe("setSelectionToolbarCustomActions", () => {
  it("moves the custom actions within their own places in the toolbar order", () => {
    const selectionToolbar = toolbarWith(
      ["a", "b", "c"],
      ["a", "translate", "b", "speak", "c", "default-dictionary", "default-sentence-analysis"],
    )
    const [a, b, c] = selectionToolbar.customActions
    const next = setSelectionToolbarCustomActions(selectionToolbar, [c!, a!, b!])

    expect(next.customActions.map((action) => action.id)).toEqual(["c", "a", "b"])
    expect(next.order).toEqual([
      "c",
      "translate",
      "a",
      "speak",
      "b",
      "default-dictionary",
      "default-sentence-analysis",
    ])
  })

  it("places an action the order does not name yet after the rest", () => {
    const selectionToolbar = toolbarWith(["a"], ["a", "translate"])
    const dictionary = getBuiltInDictionaryAction(selectionToolbar)
    const added = { ...dictionary, id: "added", name: "added" }
    const next = setSelectionToolbarCustomActions(selectionToolbar, [
      ...selectionToolbar.customActions,
      added,
    ])
    expect(next.order.at(-1)).toBe("added")
  })
})

describe("setSelectionToolbarItemEnabled", () => {
  it("pins and unpins the features by their own switch", () => {
    const next = setSelectionToolbarItemEnabled(toolbarWith(), "speak", false)
    expect(next.features.speak.enabled).toBe(false)
    expect(next.features.translate.enabled).toBe(true)
    expect(setSelectionToolbarItemEnabled(next, "speak", true).features.speak.enabled).toBe(true)
  })

  it("pins and unpins built-in and custom actions by their enabled state", () => {
    const selectionToolbar = toolbarWith(["a"])
    const builtIn = setSelectionToolbarItemEnabled(selectionToolbar, "default-dictionary", false)
    expect(builtIn.builtInActions.dictionary.enabled).toBe(false)

    const custom = setSelectionToolbarItemEnabled(selectionToolbar, "a", false)
    expect(custom.customActions[0]!.enabled).toBe(false)
  })

  it("leaves the toolbar as it is for an unknown id", () => {
    const selectionToolbar = toolbarWith()
    expect(setSelectionToolbarItemEnabled(selectionToolbar, "gone", false)).toBe(selectionToolbar)
  })
})
