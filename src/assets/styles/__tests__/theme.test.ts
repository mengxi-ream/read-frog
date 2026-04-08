import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const themeCss = readFileSync(new URL("../theme.css", import.meta.url), "utf8")

describe("theme.css", () => {
  it("namespaces theme tokens with read-frog prefixes", () => {
    const normalizedThemeCss = themeCss.replace(/\s+/g, " ")

    expect(normalizedThemeCss).toContain("--font-sans: var(--rf-font-sans);")
    expect(normalizedThemeCss).toContain("--font-mono: var(--rf-font-mono);")
    expect(normalizedThemeCss).toContain("--color-border: var(--rf-border);")
    expect(normalizedThemeCss).toContain("--color-background: var(--rf-background);")
    expect(normalizedThemeCss).toContain("--shadow-floating: var(--rf-elevation-floating);")
    expect(normalizedThemeCss).toContain("--rf-font-sans: ui-sans-serif, system-ui, sans-serif")
    expect(normalizedThemeCss).toContain("--rf-font-mono: ui-monospace, SFMono-Regular, Menlo")
    expect(normalizedThemeCss).toContain("--rf-border: oklch(0.92 0.004 286.32);")
    expect(normalizedThemeCss).not.toContain("--font-sans: var(--font-sans);")
    expect(normalizedThemeCss).not.toContain("--font-mono: var(--font-mono);")
    expect(normalizedThemeCss).not.toContain("--color-border: var(--border);")
    expect(normalizedThemeCss).not.toContain("--color-background: var(--background);")
  })
})
