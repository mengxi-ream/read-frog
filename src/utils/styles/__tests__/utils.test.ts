import { describe, expect, it } from "vitest"
import { cn } from "../utils"

describe("cn", () => {
  it.each([
    ["shadow-sm", "shadow-floating", "shadow-floating"],
    ["shadow-floating", "shadow-sm", "shadow-sm"],
    ["shadow-floating", "shadow-none", "shadow-none"],
    ["shadow-floating", "shadow-red-500", "shadow-floating shadow-red-500"],
    [
      "shadow-floating hover:shadow-sm",
      "hover:shadow-floating",
      "shadow-floating hover:shadow-floating",
    ],
  ])("merges floating shadow styles: %s + %s", (base, override, expected) => {
    expect(cn(base, override)).toBe(expected)
  })

  it("resolves overrides after joining conditional and nested classes", () => {
    expect(
      cn("px-2 shadow-sm", [false, null, undefined, ["px-4"]], {
        "shadow-floating": true,
        "shadow-none": false,
      }),
    ).toBe("px-4 shadow-floating")
  })
})
