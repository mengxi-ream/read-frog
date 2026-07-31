import { NavigationType } from "react-router"
import { describe, expect, it } from "vitest"
import { resolveScrollTarget } from "../scroll-restoration"

describe("resolveScrollTarget", () => {
  it("leaves the first render alone so a reload keeps the browser's offset", () => {
    expect(
      resolveScrollTarget({
        navigationType: NavigationType.Pop,
        savedOffset: 420,
        pathname: "/preference",
        previousPathname: null,
      }),
    ).toBeNull()
  })

  it("opens a newly pushed page at the top", () => {
    expect(
      resolveScrollTarget({
        navigationType: NavigationType.Push,
        savedOffset: undefined,
        pathname: "/preference/config-backup",
        previousPathname: "/preference",
      }),
    ).toBe(0)
  })

  it("restores the offset saved for the entry being popped back to", () => {
    expect(
      resolveScrollTarget({
        navigationType: NavigationType.Pop,
        savedOffset: 420,
        pathname: "/preference",
        previousPathname: "/preference/config-backup",
      }),
    ).toBe(420)
  })

  it("falls back to the top when the popped entry has no saved offset", () => {
    expect(
      resolveScrollTarget({
        navigationType: NavigationType.Pop,
        savedOffset: undefined,
        pathname: "/preference",
        previousPathname: "/preference/config-backup",
      }),
    ).toBe(0)
  })

  it("keeps the offset when only the query changes on the same page", () => {
    expect(
      resolveScrollTarget({
        navigationType: NavigationType.Push,
        savedOffset: undefined,
        pathname: "/page-translation",
        previousPathname: "/page-translation",
      }),
    ).toBeNull()
  })
})
