import { afterEach, describe, expect, it } from "vitest"
import { browser } from "#imports"
import { isExtensionContextAlive, isExtensionContextInvalidatedError } from "../extension-context"

const liveRuntimeId = browser.runtime.id

function killExtensionContext() {
  Object.defineProperty(browser.runtime, "id", { configurable: true, value: undefined })
}

afterEach(() => {
  Object.defineProperty(browser.runtime, "id", { configurable: true, value: liveRuntimeId })
})

describe("isExtensionContextAlive", () => {
  it("is alive while runtime.id is set", () => {
    expect(isExtensionContextAlive()).toBe(true)
  })

  it("is dead once Chrome clears runtime.id on the stale side of an update", () => {
    killExtensionContext()
    expect(isExtensionContextAlive()).toBe(false)
  })
})

describe("isExtensionContextInvalidatedError", () => {
  it("matches the error Chrome throws from a stale content script", () => {
    expect(isExtensionContextInvalidatedError(new Error("Extension context invalidated."))).toBe(
      true,
    )
  })

  it("matches the wording variants and plain strings", () => {
    expect(isExtensionContextInvalidatedError("Extension context was invalidated.")).toBe(true)
    expect(isExtensionContextInvalidatedError({ message: "extension context invalidated" })).toBe(
      true,
    )
  })

  it("leaves ordinary translation failures alone", () => {
    expect(isExtensionContextInvalidatedError(new Error("401 Unauthorized"))).toBe(false)
    expect(isExtensionContextInvalidatedError(undefined)).toBe(false)
    // A missing background worker is a different, self-healing failure — the
    // page does not need a reload for it.
    expect(
      isExtensionContextInvalidatedError(
        new Error("Could not establish connection. Receiving end does not exist."),
      ),
    ).toBe(false)
  })

  it("treats any failure as invalidation once the context itself is dead", () => {
    killExtensionContext()
    expect(isExtensionContextInvalidatedError(new Error("401 Unauthorized"))).toBe(true)
  })
})
