import { describe, expect, it, vi } from "vitest"

// This file is a canary against @iconify/react upgrades dropping the internal
// _api that setup-background-fetch.ts depends on, so it must import the real
// package, not the inert global mock from vitest.setup.ts.
vi.unmock("@iconify/react")

const { _api } = await import("@iconify/react")

describe("iconify internal api", () => {
  it("exposes _api.setFetch", () => {
    expect(typeof _api.setFetch).toBe("function")
  })
})
