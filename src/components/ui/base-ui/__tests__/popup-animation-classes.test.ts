import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { SHARED_POPUP_CLOSED_STATE_CLASS } from "../popup-animation-classes"

async function readSource(relativePath: string) {
  return await readFile(new URL(relativePath, import.meta.url), "utf8")
}

describe("shared popup animation classes", () => {
  it("exports the shared closed-state contract", () => {
    expect(SHARED_POPUP_CLOSED_STATE_CLASS).toBe("data-closed:pointer-events-none data-closed:[animation-fill-mode:forwards]")
  })

  it("is applied to popup-like base-ui primitives", async () => {
    const files = await Promise.all([
      readSource("../select.tsx"),
      readSource("../combobox.tsx"),
      readSource("../popover.tsx"),
      readSource("../dropdown-menu.tsx"),
      readSource("../tooltip.tsx"),
      readSource("../dialog.tsx"),
      readSource("../alert-dialog.tsx"),
      readSource("../hover-card.tsx"),
      readSource("../sheet.tsx"),
    ])

    for (const source of files) {
      expect(source).toContain("SHARED_POPUP_CLOSED_STATE_CLASS")
    }
  })
})
