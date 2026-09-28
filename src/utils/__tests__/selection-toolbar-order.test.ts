import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { createStore } from "jotai"
import { afterEach, describe, expect, it } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { configSchema } from "@/types/config/config"
import { configAtom, writeConfigAtom } from "@/utils/atoms/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { getBuiltInDictionaryAction } from "@/utils/custom-actions"
import { normalizeSelectionToolbarLists } from "@/utils/selection-toolbar-order"

const DEFAULT_ORDER = [
  "translate",
  "speak",
  "default-dictionary",
  "default-sentence-analysis",
  "default-improve-writing",
]

function customAction(id: string): SelectionToolbarCustomAction {
  const dictionary = getBuiltInDictionaryAction(DEFAULT_CONFIG.selectionToolbar)
  return { ...dictionary, id, name: id }
}

function configWith(customIds: string[], order: string[], unpinned: string[] = []): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.selectionToolbar.customActions = customIds.map(customAction)
  config.selectionToolbar.order = order
  config.selectionToolbar.unpinned = unpinned
  return config
}

afterEach(() => {
  fakeBrowser.reset()
})

describe("normalizeSelectionToolbarLists", () => {
  const lists = (customIds: string[], order?: string[], unpinned?: string[]) =>
    normalizeSelectionToolbarLists({
      customActions: customIds.map((id) => ({ id })),
      order,
      unpinned,
    })

  it("keeps a saved order that names every item as it is", () => {
    const order = ["b", "speak", "default-improve-writing", "translate", "a"]
    const next = lists(["a", "b"], [...order, "default-dictionary", "default-sentence-analysis"])
    expect(next.order).toEqual([...order, "default-dictionary", "default-sentence-analysis"])
  })

  it("adds the items the order does not name after it, in the default order", () => {
    // A custom action added since, and whatever else the order lacks.
    expect(lists(["a", "new"], ["a", "speak"]).order).toEqual([
      "a",
      "speak",
      "translate",
      "default-dictionary",
      "default-sentence-analysis",
      "default-improve-writing",
      "new",
    ])
    expect(lists([], undefined).order).toEqual(DEFAULT_ORDER)
  })

  it("drops ids no item has, and repeats, from both lists", () => {
    const next = lists(["a"], ["gone", "a", "speak", "a", "gone"], ["gone", "a", "a"])
    expect(next.order.slice(0, 2)).toEqual(["a", "speak"])
    expect(next.order).toHaveLength(DEFAULT_ORDER.length + 1)
    expect(next.unpinned).toEqual(["a"])
  })

  it("keeps the pins of disabled items: they are still items", () => {
    expect(lists(["a"], undefined, ["speak", "a"]).unpinned).toEqual(["speak", "a"])
  })
})

describe("the config schema", () => {
  it("brings the toolbar's order and pins in step with its actions on every parse", () => {
    const parsed = configSchema.parse(configWith(["b"], ["gone", "b", "speak"], ["gone", "b"]))
    expect(parsed.selectionToolbar.order).toEqual([
      "b",
      "speak",
      "translate",
      "default-dictionary",
      "default-sentence-analysis",
      "default-improve-writing",
    ])
    expect(parsed.selectionToolbar.unpinned).toEqual(["b"])
  })
})

describe("writing the config", () => {
  async function storedToolbar() {
    const stored = await fakeBrowser.storage.local.get(CONFIG_STORAGE_KEY)
    return (stored[CONFIG_STORAGE_KEY] as Config).selectionToolbar
  }

  async function setUp(config: Config) {
    await fakeBrowser.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
    const store = createStore()
    store.set(configAtom, config)
    return store
  }

  it("stores no trace of a deleted action, though the delete only removes the action", async () => {
    const store = await setUp(configWith(["a", "b"], [...DEFAULT_ORDER, "a", "b"], ["a"]))

    await store.set(writeConfigAtom, (current) => ({
      selectionToolbar: {
        ...current.selectionToolbar,
        customActions: current.selectionToolbar.customActions.filter((action) => action.id !== "a"),
      },
    }))

    const toolbar = await storedToolbar()
    expect(toolbar.order).toEqual([...DEFAULT_ORDER, "b"])
    expect(toolbar.unpinned).toEqual([])
  })

  it("stores a new action at the end of the order, though adding it only adds the action", async () => {
    const store = await setUp(configWith(["a"], ["a", ...DEFAULT_ORDER]))

    await store.set(writeConfigAtom, (current) => ({
      selectionToolbar: {
        ...current.selectionToolbar,
        customActions: [...current.selectionToolbar.customActions, customAction("c")],
      },
    }))

    expect((await storedToolbar()).order).toEqual(["a", ...DEFAULT_ORDER, "c"])
  })
})
