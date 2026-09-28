import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getBuiltInDictionaryAction } from "@/utils/custom-actions"
import {
  getSelectionToolbarItems,
  reorderSelectionToolbarItems,
  setSelectionToolbarCustomActions,
  setSelectionToolbarItemPinned,
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
      "default-improve-writing",
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
      "default-improve-writing",
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
      "default-improve-writing",
      "new",
    ])
  })

  it("reads each item's enabled switch, and pins everything the unpinned list does not name", () => {
    const selectionToolbar = toolbarWith(["a", "b"])
    selectionToolbar.features.speak.enabled = false
    selectionToolbar.builtInActions.sentenceAnalysis.enabled = false
    selectionToolbar.customActions[0]!.enabled = false
    selectionToolbar.unpinned = ["speak", "b", "gone"]
    const states = Object.fromEntries(
      getSelectionToolbarItems(selectionToolbar).map((item) => [
        item.id,
        [item.enabled, item.pinned],
      ]),
    )
    expect(states).toEqual({
      translate: [true, true],
      speak: [false, false],
      "default-dictionary": [true, true],
      "default-sentence-analysis": [false, true],
      "default-improve-writing": [true, true],
      a: [false, true],
      b: [true, false],
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
      "default-improve-writing",
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

describe("reorderSelectionToolbarItems for the enabled items only", () => {
  it("moves them among their own places, leaving the disabled ones where they were", () => {
    const selectionToolbar = toolbarWith(["a", "b"])
    selectionToolbar.features.speak.enabled = false
    selectionToolbar.customActions[0]!.enabled = false
    // The menu lists translate, the three built-in actions and b; b goes first.
    const next = reorderSelectionToolbarItems(selectionToolbar, [
      "b",
      "translate",
      "default-dictionary",
      "default-sentence-analysis",
      "default-improve-writing",
    ])

    expect(next.order).toEqual([
      "b",
      "speak",
      "translate",
      "default-dictionary",
      "default-sentence-analysis",
      "a",
      "default-improve-writing",
    ])
    expect(next.customActions.map((action) => action.id)).toEqual(["b", "a"])
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
      "default-improve-writing",
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

describe("setSelectionToolbarItemPinned", () => {
  it("unpins and pins an item through the unpinned list, once each", () => {
    // Improve Writing starts unpinned.
    const unpinned = setSelectionToolbarItemPinned(toolbarWith(), "speak", false)
    expect(unpinned.unpinned).toEqual(["default-improve-writing", "speak"])
    expect(setSelectionToolbarItemPinned(unpinned, "speak", false).unpinned).toEqual([
      "default-improve-writing",
      "speak",
    ])
    expect(setSelectionToolbarItemPinned(unpinned, "speak", true).unpinned).toEqual([
      "default-improve-writing",
    ])
  })

  it("leaves the item's enabled switch alone, so the pin outlives turning it off and on", () => {
    const selectionToolbar = toolbarWith(["a"])
    const next = setSelectionToolbarItemPinned(selectionToolbar, "a", false)
    expect(next.customActions).toBe(selectionToolbar.customActions)
    expect(next.features).toBe(selectionToolbar.features)
    expect(next.builtInActions).toBe(selectionToolbar.builtInActions)

    next.customActions = [{ ...next.customActions[0]!, enabled: false }]
    next.customActions = [{ ...next.customActions[0]!, enabled: true }]
    expect(getSelectionToolbarItems(next).find((item) => item.id === "a")?.pinned).toBe(false)
  })
})
