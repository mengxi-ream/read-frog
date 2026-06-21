import { describe, expect, it } from "vitest"
import { getSubtitlesPanelPlacementOptions } from "../panel-shell"

describe("subtitles settings panel placement", () => {
  it("keeps the default embedded panel above the trigger", () => {
    const placement = getSubtitlesPanelPlacementOptions({
      bottomOffset: 78,
      embedded: true,
      open: true,
    })

    expect(placement.positionClassName).toContain("bottom-full")
    expect(placement.positionClassName).toContain("right-0")
    expect(placement.positionStyle).toEqual({ marginBottom: "78px" })
  })

  it("places the x.com embedded panel to the left of the overlay trigger", () => {
    const placement = getSubtitlesPanelPlacementOptions({
      bottomOffset: 78,
      embedded: true,
      open: true,
      placement: "left",
    })

    expect(placement.positionClassName).toContain("right-full")
    expect(placement.positionClassName).toContain("bottom-0")
    expect(placement.positionClassName).not.toContain("bottom-full")
    expect(placement.positionStyle).toEqual({ marginRight: "12px" })
  })
})
