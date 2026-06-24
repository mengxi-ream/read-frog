// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useDelayedTruthy } from "../use-delayed-truthy"

const DELAY_MS = 600

describe("useDelayedTruthy", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("delays truthy values and restarts after false", async () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ resetKey, value }) => useDelayedTruthy(value, DELAY_MS, resetKey),
      { initialProps: { resetKey: 0, value: false } },
    )

    expect(result.current).toBe(false)

    await act(() => rerender({ resetKey: 1, value: true }))
    expect(result.current).toBe(false)

    await act(() => vi.advanceTimersByTime(DELAY_MS - 1))
    expect(result.current).toBe(false)

    await act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)

    await act(() => rerender({ resetKey: 1, value: false }))
    expect(result.current).toBe(false)

    await act(() => rerender({ resetKey: 1, value: true }))
    expect(result.current).toBe(false)

    await act(() => vi.advanceTimersByTime(DELAY_MS - 1))
    expect(result.current).toBe(false)

    await act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
  })
})
