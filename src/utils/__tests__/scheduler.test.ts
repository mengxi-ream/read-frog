import { afterEach, describe, expect, it, vi } from "vitest"
import { createWorkPacer, pauseIfBudgetSpent, yieldToMain } from "../scheduler"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("yieldToMain", () => {
  it("prefers scheduler.yield when available", async () => {
    const yieldFn = vi.fn<() => Promise<void>>(() => Promise.resolve())
    vi.stubGlobal("scheduler", { yield: yieldFn })

    await yieldToMain()
    expect(yieldFn).toHaveBeenCalledTimes(1)
  })

  it("falls back to scheduler.postTask", async () => {
    const postTask = vi.fn<
      (callback: () => void, options?: { priority?: string }) => Promise<void>
    >((callback) => {
      callback()
      return Promise.resolve()
    })
    vi.stubGlobal("scheduler", { postTask })

    await yieldToMain()
    expect(postTask).toHaveBeenCalledTimes(1)
    expect(postTask.mock.calls[0][1]).toEqual({ priority: "user-visible" })
  })

  it("falls back to MessageChannel when no scheduler exists", async () => {
    vi.stubGlobal("scheduler", undefined)
    await expect(yieldToMain()).resolves.toBeUndefined()
  })

  it("falls back to setTimeout when MessageChannel is unavailable", async () => {
    vi.stubGlobal("scheduler", undefined)
    vi.stubGlobal("MessageChannel", undefined)
    await expect(yieldToMain()).resolves.toBeUndefined()
  })
})

describe("pauseIfBudgetSpent", () => {
  it("does not yield while the slice budget remains", async () => {
    const yieldFn = vi.fn<() => Promise<void>>(() => Promise.resolve())
    vi.stubGlobal("scheduler", { yield: yieldFn })

    const pacer = createWorkPacer(10_000)
    await pauseIfBudgetSpent(pacer)
    expect(yieldFn).not.toHaveBeenCalled()
  })

  it("yields and renews the deadline once the budget is spent", async () => {
    const yieldFn = vi.fn<() => Promise<void>>(() => Promise.resolve())
    vi.stubGlobal("scheduler", { yield: yieldFn })

    const pacer = createWorkPacer(0)
    const spentDeadline = pacer.deadline
    await new Promise((resolve) => setTimeout(resolve, 1))

    await pauseIfBudgetSpent(pacer)
    expect(yieldFn).toHaveBeenCalledTimes(1)
    expect(pacer.deadline).toBeGreaterThan(spentDeadline)
  })
})
