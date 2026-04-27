import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("native sidepanel entrypoints", () => {
  it("keeps split translator as the only native side panel entrypoint", () => {
    const entrypointsDir = resolve(import.meta.dirname, "..")

    expect(existsSync(resolve(entrypointsDir, "split-translator", "index.html"))).toBe(true)
    expect(existsSync(resolve(entrypointsDir, "sidepanel", "index.html"))).toBe(false)
    expect(existsSync(resolve(entrypointsDir, "sidepanel", "main.tsx"))).toBe(false)
  })
})
