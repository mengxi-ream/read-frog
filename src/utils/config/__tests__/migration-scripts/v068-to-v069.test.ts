import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v068-to-v069"

describe("v068-to-v069 migration", () => {
  it("adds floatingButton.side with a default right value", () => {
    const migrated = migrate({
      floatingButton: {
        enabled: true,
        position: 0.66,
        disabledFloatingButtonPatterns: [],
        clickAction: "translate",
        locked: false,
      },
    })

    expect(migrated.floatingButton.side).toBe("right")
  })

  it("preserves an existing floatingButton.side value", () => {
    const migrated = migrate({
      floatingButton: {
        enabled: true,
        position: 0.66,
        side: "left",
        disabledFloatingButtonPatterns: [],
        clickAction: "translate",
        locked: false,
      },
    })

    expect(migrated.floatingButton.side).toBe("left")
  })
})
