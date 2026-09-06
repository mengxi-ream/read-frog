import { describe, expect, it } from "vitest"
import { cn } from "../utils"

describe("cn", () => {
  it.each([
    ["shadow-sm", "shadow-(--rf-elevation-floating)", "shadow-(--rf-elevation-floating)"],
    ["shadow-(--rf-elevation-floating)", "shadow-sm", "shadow-sm"],
    ["shadow-(--rf-elevation-floating)", "shadow-none", "shadow-none"],
    [
      "shadow-(--rf-elevation-floating)",
      "shadow-red-500",
      "shadow-(--rf-elevation-floating) shadow-red-500",
    ],
    [
      "shadow-(--rf-elevation-floating) hover:shadow-sm",
      "hover:shadow-(--rf-elevation-floating)",
      "shadow-(--rf-elevation-floating) hover:shadow-(--rf-elevation-floating)",
    ],
  ])("merges floating shadow styles: %s + %s", (base, override, expected) => {
    expect(cn(base, override)).toBe(expected)
  })

  it("resolves overrides after joining conditional and nested classes", () => {
    expect(
      cn("px-2 shadow-sm", [false, null, undefined, ["px-4"]], {
        "shadow-(--rf-elevation-floating)": true,
        "shadow-none": false,
      }),
    ).toBe("px-4 shadow-(--rf-elevation-floating)")
  })
})
