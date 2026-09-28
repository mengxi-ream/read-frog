import { describe, expect, it } from "vitest"
import { getBundledLobeIconUrlFn } from "../logo"

describe("getBundledLobeIconUrlFn", () => {
  it.each(["light", "dark"] as const)("returns the bundled %s icon URL", (theme) => {
    const iconUrl = getBundledLobeIconUrlFn("azure-color")(theme)

    expect(iconUrl).toContain(`${theme}-azure-color`)
    expect(iconUrl).not.toMatch(/^https?:/)
  })

  it("rejects icons that are not bundled", () => {
    expect(() => getBundledLobeIconUrlFn("missing")("light")).toThrow(
      "Unknown bundled Lobe icon: light/missing",
    )
  })
})
