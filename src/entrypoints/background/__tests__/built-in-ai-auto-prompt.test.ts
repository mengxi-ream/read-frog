import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"

describe("claimBuiltInAiAutoPrompt", () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.resetModules()
  })

  async function loadClaim() {
    return (await import("../built-in-ai-auto-prompt")).claimBuiltInAiAutoPrompt
  }

  it("gives automatic translation one dialog a browser session", async () => {
    const claim = await loadClaim()

    await expect(claim()).resolves.toBe(true)
    await expect(claim()).resolves.toBe(false)
    await expect(claim()).resolves.toBe(false)
  })

  it("hands it to only one of two tabs that run dry together", async () => {
    const claim = await loadClaim()

    const results = await Promise.all([claim(), claim(), claim()])

    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it("remembers it across a service worker restart", async () => {
    await expect((await loadClaim())()).resolves.toBe(true)

    vi.resetModules()

    await expect((await loadClaim())()).resolves.toBe(false)
  })

  it("gives it again in a new browser session", async () => {
    const claim = await loadClaim()
    await claim()

    // Closing the browser clears session storage.
    await fakeBrowser.storage.session.clear()

    await expect(claim()).resolves.toBe(true)
  })
})
