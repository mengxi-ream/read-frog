import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Each bundle has its own copy of the logger, and a bundle whose entrypoint
// never sets logging up drops every record in production. This keeps a new
// entrypoint from shipping that way unnoticed.

const ENTRYPOINTS_DIR = path.resolve("src/entrypoints")

const EXTENSION_PAGES = ["offscreen", "options", "popup", "sidepanel", "translation-hub"]

// Bootstraps injected into a great many frames, kept as small as they can be.
// They log nothing themselves; what they load sets up its own logging.
const EXEMPT = new Set([
  "loader.content.ts",
  "iframe-selection-trigger.content.ts",
  "ebook-section.content.ts",
])

function entryFile(name: string): string {
  const entry = path.join(ENTRYPOINTS_DIR, name)
  if (!name.includes(".") || name.endsWith(".content")) {
    const file = ["index.ts", "index.tsx", "main.ts", "main.tsx"]
      .map((candidate) => path.join(entry, candidate))
      .find((candidate) => existsSync(candidate))
    if (!file) throw new Error(`No entry file in ${name}`)
    return file
  }
  return entry
}

const entrypoints = readdirSync(ENTRYPOINTS_DIR)
  .filter((name) => name !== "__tests__" && !EXEMPT.has(name))
  .map((name) => ({ name, source: readFileSync(entryFile(name), "utf8") }))

const isMainWorld = (source: string) => /world:\s*"MAIN"/.test(source)

function setupCallFor(name: string): string {
  if (name === "background") return "setupBackgroundLogging()"
  if (EXTENSION_PAGES.includes(name)) return `setupExtensionPageLogging("${name}")`
  return "setupContentScriptLogging()"
}

const loggingEntrypoints = entrypoints
  .filter(({ source }) => !isMainWorld(source))
  .map(({ name, source }) => ({ name, source, call: setupCallFor(name) }))

const mainWorldEntrypoints = entrypoints.filter(({ source }) => isMainWorld(source))

describe("entrypoint logging setup", () => {
  it("finds the entrypoints", () => {
    expect(entrypoints.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["background", "content-runtime", ...EXTENSION_PAGES]),
    )
  })

  it.each(loggingEntrypoints)("$name calls $call", ({ source, call }) => {
    expect(source).toContain(call)
  })

  // The page's own world has no extension APIs to forward records with.
  it.each(mainWorldEntrypoints)("$name, in the page's own world, sets none up", ({ source }) => {
    expect(source).not.toMatch(/setup\w*Logging\(/)
  })
})
