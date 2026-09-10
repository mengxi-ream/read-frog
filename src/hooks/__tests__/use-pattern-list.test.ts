// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { usePatternList } from "../use-pattern-list"

function setup(patterns: string[]) {
  const onChange = vi.fn<(next: string[]) => void>()
  const { result } = renderHook(() => usePatternList(patterns, onChange))
  return { result, onChange }
}

function add(patterns: string[], input: string) {
  const { result, onChange } = setup(patterns)
  let outcome: string | undefined
  act(() => {
    outcome = result.current.addPattern(input)
  })
  return { outcome, onChange }
}

describe("usePatternList", () => {
  it("stores a typed pattern exactly as typed", () => {
    const { outcome, onChange } = add(["*.example.com"], "  reddit.com  ")

    expect(outcome).toBe("added")
    expect(onChange).toHaveBeenCalledWith(["reddit.com", "*.example.com"])
  })

  /**
   * `example.com` and `*.example.com` are different patterns — the first is that
   * exact host — so both may sit in one list. Widening the typed one would make
   * the row disagree with what was entered.
   */
  it("does not widen a bare host into its subdomains", () => {
    const { outcome, onChange } = add(["*.example.com"], "example.com")

    expect(outcome).toBe("added")
    expect(onChange).toHaveBeenCalledWith(["example.com", "*.example.com"])
  })

  it("leaves a pattern that is already one alone", () => {
    const { outcome, onChange } = add([], "example.com/docs/*")

    expect(outcome).toBe("added")
    expect(onChange).toHaveBeenCalledWith(["example.com/docs/*"])
  })

  it("catches a duplicate once trimmed", () => {
    const { outcome, onChange } = add(["example.com"], "  example.com  ")

    expect(outcome).toBe("duplicate")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("rejects a blank pattern without touching the list", () => {
    const { outcome, onChange } = add(["*.example.com"], "   ")

    expect(outcome).toBe("empty")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("rejects a wildcard glued to text, which would not stop at a label boundary", () => {
    const { outcome, onChange } = add([], "*example.com")

    expect(outcome).toBe("gluedWildcard")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("rejects an address the matcher would silently drop", () => {
    expect(add([], "localhost:5173").outcome).toBe("unsupported")
    expect(add([], "ftp://example.com").outcome).toBe("unsupported")
  })

  it("removes every matching entry by value", () => {
    const { result, onChange } = setup(["*.a.com", "*.b.com", "*.c.com"])

    act(() => {
      result.current.removePattern("*.b.com")
    })

    expect(onChange).toHaveBeenCalledWith(["*.a.com", "*.c.com"])
  })
})
