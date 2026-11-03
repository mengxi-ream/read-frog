import { afterEach, describe, expect, it, vi } from "vitest"
import { difficultWordsTab } from "../tab-state"

afterEach(() => {
  difficultWordsTab.update({ enabled: false, count: 0 })
})

describe("difficultWordsTab", () => {
  it("tells its listeners when the state changes, and only then", () => {
    const listener = vi.fn<() => void>()
    const unsubscribe = difficultWordsTab.subscribe(listener)

    difficultWordsTab.update({ enabled: true })
    difficultWordsTab.update({ enabled: true, count: 0 })
    difficultWordsTab.update({ count: 3 })

    expect(listener).toHaveBeenCalledTimes(2)
    expect(difficultWordsTab.getState()).toEqual({ enabled: true, count: 3 })

    unsubscribe()
    difficultWordsTab.update({ count: 4 })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("passes a switch to what runs the marking, and nowhere once it is gone", () => {
    const first = vi.fn<Parameters<typeof difficultWordsTab.install>[0]>()
    const second = vi.fn<Parameters<typeof difficultWordsTab.install>[0]>()
    const uninstallFirst = difficultWordsTab.install(first)
    const uninstallSecond = difficultWordsTab.install(second)

    // Taking back the first must not take the second away.
    uninstallFirst()
    difficultWordsTab.setEnabled(true, "floating_button")
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(true, "floating_button")

    uninstallSecond()
    difficultWordsTab.setEnabled(false, null)
    expect(second).toHaveBeenCalledTimes(1)
  })
})
