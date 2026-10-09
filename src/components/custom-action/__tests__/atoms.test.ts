import { createStore } from "jotai"
import { describe, expect, it } from "vitest"
import { customActionRequestAtom, rerunCustomActionAtom } from "../atoms"

const REQUEST = {
  actionId: "default-dictionary",
  selectionText: "patience",
  contextText: "I'm running out of patience.",
  surface: "selection_toolbar" as const,
  sessionKey: 1,
  rerunNonce: 0,
}

describe("rerunCustomActionAtom", () => {
  it("bumps the rerun nonce of the active request", () => {
    const store = createStore()
    store.set(customActionRequestAtom, REQUEST)

    store.set(rerunCustomActionAtom)

    expect(store.get(customActionRequestAtom)).toEqual({ ...REQUEST, rerunNonce: 1 })
  })

  it("does nothing without an active request", () => {
    const store = createStore()

    store.set(rerunCustomActionAtom)

    expect(store.get(customActionRequestAtom)).toBeNull()
  })
})
