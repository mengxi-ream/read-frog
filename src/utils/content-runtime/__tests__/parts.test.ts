import { describe, expect, it } from "vitest"
import { CONTENT_RUNTIME_PARTS_WINDOW_KEY, takeRequestedParts } from "../parts"

describe("takeRequestedParts", () => {
  it("runs the page parts in the top frame the manifest injects", () => {
    // Subtitles come from their own loader, on video sites only
    expect(takeRequestedParts({}, true)).toEqual(["host", "selection", "side"])
  })

  it("takes the parts the background asked for", () => {
    const scriptGlobal: Record<string, unknown> = {
      [CONTENT_RUNTIME_PARTS_WINDOW_KEY]: ["host", "selection"],
    }

    expect(takeRequestedParts(scriptGlobal, false)).toEqual(["host", "selection"])
    expect(scriptGlobal).not.toHaveProperty(CONTENT_RUNTIME_PARTS_WINDOW_KEY)
  })

  it("runs nothing in an iframe whose parts an earlier loader took", () => {
    const scriptGlobal: Record<string, unknown> = { [CONTENT_RUNTIME_PARTS_WINDOW_KEY]: ["host"] }

    expect(takeRequestedParts(scriptGlobal, false)).toEqual(["host"])
    expect(takeRequestedParts(scriptGlobal, false)).toEqual([])
  })
})
