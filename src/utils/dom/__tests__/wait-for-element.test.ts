// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"

import { waitForElement } from "../wait-for-element"

describe("waitForElement", () => {
  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.innerHTML = "<head></head><body></body>"
  })

  it("waits from documentElement when document.body is not ready", async () => {
    document.body?.remove()

    expect(document.body).toBeNull()

    const promise = waitForElement("#late")
    const body = document.createElement("body")
    const element = document.createElement("div")
    element.id = "late"
    body.appendChild(element)

    document.documentElement.appendChild(body)

    await expect(promise).resolves.toBe(element)
  })

  it("resolves null after the wait timeout", async () => {
    vi.useFakeTimers()

    const promise = waitForElement("#missing")
    await vi.advanceTimersByTimeAsync(10000)

    await expect(promise).resolves.toBeNull()
  })
})
