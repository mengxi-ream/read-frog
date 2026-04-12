import { describe, expect, it } from "vitest"
import { preloadConfigSchema } from "../translate"

describe("preload config validation", () => {
  it("allows a preload margin up to 10000 pixels", () => {
    const result = preloadConfigSchema.safeParse({
      margin: 10000,
      threshold: 0,
    })

    expect(result.success).toBe(true)
  })

  it("rejects a preload margin above 10000 pixels", () => {
    const result = preloadConfigSchema.safeParse({
      margin: 10001,
      threshold: 0,
    })

    expect(result.success).toBe(false)
  })
})
