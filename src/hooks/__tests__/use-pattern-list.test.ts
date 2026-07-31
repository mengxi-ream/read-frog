// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { usePatternList } from "../use-pattern-list"

function setup(patterns: string[]) {
  const onChange = vi.fn<(next: string[]) => void>()
  const { result } = renderHook(() => usePatternList(patterns, onChange))
  return { result, onChange }
}

describe("usePatternList", () => {
  it("prepends a trimmed pattern so the newest sits first", () => {
    const { result, onChange } = setup(["example.com"])

    let outcome: string | undefined
    act(() => {
      outcome = result.current.addPattern("  reddit.com  ")
    })

    expect(outcome).toBe("added")
    expect(onChange).toHaveBeenCalledWith(["reddit.com", "example.com"])
  })

  it("rejects a duplicate without touching the list", () => {
    const { result, onChange } = setup(["example.com"])

    let outcome: string | undefined
    act(() => {
      outcome = result.current.addPattern(" example.com ")
    })

    expect(outcome).toBe("duplicate")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("rejects a blank pattern without touching the list", () => {
    const { result, onChange } = setup(["example.com"])

    let outcome: string | undefined
    act(() => {
      outcome = result.current.addPattern("   ")
    })

    expect(outcome).toBe("empty")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("removes every matching entry by value", () => {
    const { result, onChange } = setup(["a.com", "b.com", "c.com"])

    act(() => {
      result.current.removePattern("b.com")
    })

    expect(onChange).toHaveBeenCalledWith(["a.com", "c.com"])
  })
})
