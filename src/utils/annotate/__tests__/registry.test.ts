// @vitest-environment jsdom
import type { AnnotationRecord } from "../types"
import { describe, expect, it, vi } from "vitest"
import { AnnotationRegistry } from "../registry"

function record(
  block: Element,
  start: number,
  end: number,
  id = `${start}-${end}`,
): AnnotationRecord {
  return {
    id,
    block,
    start,
    end,
    surface: "x".repeat(end - start),
    sourceId: "manual",
    status: "loading",
    gloss: null,
    glossFits: true,
    createdAt: 0,
  }
}

describe("AnnotationRegistry", () => {
  it("lists every annotation a new span touches, contained or crossed", () => {
    const registry = new AnnotationRegistry()
    const block = document.createElement("p")
    registry.add(record(block, 10, 14))
    registry.add(record(block, 20, 25))
    const ids = (start: number, end: number) =>
      registry.overlapping(block, start, end).map((item) => item.id)

    expect(ids(0, 5)).toEqual([])
    expect(ids(5, 10)).toEqual([]) // touching is not overlapping
    expect(ids(10, 14)).toEqual(["10-14"])
    expect(ids(8, 30)).toEqual(["10-14", "20-25"])
    expect(ids(12, 22)).toEqual(["10-14", "20-25"])
    expect(ids(11, 13)).toEqual(["10-14"])
    // Another block is another text.
    expect(registry.overlapping(document.createElement("p"), 10, 14)).toEqual([])
  })

  it("keeps records by block and tells listeners about every change", () => {
    const registry = new AnnotationRegistry()
    const listener = vi.fn<() => void>()
    registry.subscribe(listener)
    const block = document.createElement("p")
    const other = document.createElement("p")

    registry.add(record(block, 0, 3, "a"))
    registry.add(record(other, 0, 3, "b"))
    expect(registry.blocks()).toEqual([block, other])
    expect(registry.recordsIn(block).map((item) => item.id)).toEqual(["a"])

    const updated = registry.update("a", { status: "ready", gloss: "猫" })
    expect(updated?.gloss).toBe("猫")
    expect(registry.get("a")).toBe(updated)
    expect(registry.all()).toHaveLength(2)

    expect(registry.remove("a")?.id).toBe("a")
    expect(registry.blocks()).toEqual([other])
    expect(registry.remove("a")).toBeNull()
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it("hands useSyncExternalStore the same snapshot until something changes", () => {
    const registry = new AnnotationRegistry()
    const before = registry.all()
    expect(registry.all()).toBe(before)
    registry.add(record(document.createElement("p"), 0, 1))
    expect(registry.all()).not.toBe(before)
  })
})
