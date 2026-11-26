import { describe, expect, it } from "vitest"
import { createOperationGeneration } from "../operation-generation"

describe("createOperationGeneration", () => {
  it("supersedes the earlier generation on next()", () => {
    const generation = createOperationGeneration()
    const earlier = generation.next()
    const latest = generation.next()

    expect(generation.isCurrent(earlier)).toBe(false)
    expect(generation.isCurrent(latest)).toBe(true)
  })

  it("reads the running generation on current() without superseding it", () => {
    const generation = createOperationGeneration()
    const running = generation.next()

    expect(generation.current()).toBe(running)
    expect(generation.isCurrent(running)).toBe(true)
  })
})
