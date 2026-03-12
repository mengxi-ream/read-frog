import { _api } from "@iconify/react"
import { describe, expect, it } from "vitest"

describe("iconify internal api", () => {
  it("exposes _api.setFetch", () => {
    expect(typeof _api.setFetch).toBe("function")
  })
})
