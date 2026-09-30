import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pollUntil } from "../poll"

describe("pollUntil", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns the first value without waiting", async () => {
    const read = vi.fn<() => string>(() => "ready")

    await expect(pollUntil(read, { timeoutMs: 1000, intervalMs: 100 })).resolves.toBe("ready")
    expect(read).toHaveBeenCalledTimes(1)
  })

  it("keeps reading until a value shows up", async () => {
    let calls = 0
    const result = pollUntil(() => (++calls === 3 ? calls : null), {
      timeoutMs: 1000,
      intervalMs: 100,
    })

    await vi.advanceTimersByTimeAsync(200)

    await expect(result).resolves.toBe(3)
  })

  it("gives up with null once the timeout passes", async () => {
    const read = vi.fn<() => undefined>(() => undefined)
    const result = pollUntil(read, { timeoutMs: 300, intervalMs: 100 })

    await vi.advanceTimersByTimeAsync(300)

    await expect(result).resolves.toBeNull()
    expect(read).toHaveBeenCalledTimes(4)
  })

  it("awaits an async reader", async () => {
    await expect(pollUntil(async () => "async", { timeoutMs: 100, intervalMs: 10 })).resolves.toBe(
      "async",
    )
  })
})
