import { describe, expect, it } from "vitest"
import { requestQueueConfigSchema } from "../translate"

describe("request queue timeout config", () => {
  it("accepts timeoutMs on request queue config", () => {
    const result = requestQueueConfigSchema.safeParse({
      capacity: 60,
      rate: 8,
      timeoutMs: 600_000,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.timeoutMs).toBe(600_000)
    }
  })

  it("rejects timeoutMs below one second", () => {
    const result = requestQueueConfigSchema.safeParse({
      capacity: 60,
      rate: 8,
      timeoutMs: 999,
    })

    expect(result.success).toBe(false)
  })
})
