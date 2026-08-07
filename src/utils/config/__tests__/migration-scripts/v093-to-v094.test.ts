import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v093-to-v094"

function configWith({
  pageShortcut = "Alt+E",
  modeShortcut = "Alt+Shift+M",
  selectionShortcut = "Alt+T",
  subtitlesShortcut = "Alt+C",
}: {
  pageShortcut?: string
  modeShortcut?: string
  selectionShortcut?: string
  subtitlesShortcut?: string
} = {}) {
  return {
    translate: {
      modeShortcut,
      page: { shortcut: pageShortcut },
    },
    selectionToolbar: {
      features: {
        translate: { shortcut: selectionShortcut },
      },
    },
    videoSubtitles: { enabled: true, toggleShortcut: subtitlesShortcut },
  }
}

describe("v093 to v094 migration", () => {
  it("adds the primary hub shortcut when nothing else claims it", () => {
    const result = migrate(configWith())

    expect(result.translationHub).toEqual({ shortcut: "Alt+Shift+H" })
  })

  it("leaves the rest of the config untouched", () => {
    const oldConfig = configWith()
    const snapshot = structuredClone(oldConfig)

    const result = migrate(oldConfig)

    expect(result).toEqual({ ...snapshot, translationHub: { shortcut: "Alt+Shift+H" } })
    expect(oldConfig).toEqual(snapshot)
  })

  it.each([
    ["page translation", { pageShortcut: "Alt+Shift+H" }],
    ["translation mode", { modeShortcut: "Alt+Shift+H" }],
    ["selection translation", { selectionShortcut: "Alt+Shift+H" }],
    ["subtitles toggle", { subtitlesShortcut: "Alt+Shift+H" }],
  ])("falls back when %s already uses the primary key", (_label, overrides) => {
    const result = migrate(configWith(overrides))

    expect(result.translationHub.shortcut).toBe("Alt+Shift+U")
  })

  it("ignores case and surrounding whitespace when detecting a collision", () => {
    const result = migrate(configWith({ modeShortcut: "  alt+shift+h  " }))

    expect(result.translationHub.shortcut).toBe("Alt+Shift+U")
  })

  it("leaves the shortcut unbound when both candidates are taken", () => {
    const result = migrate(configWith({ pageShortcut: "Alt+Shift+H", modeShortcut: "Alt+Shift+U" }))

    expect(result.translationHub.shortcut).toBe("")
  })

  it("is idempotent", () => {
    const once = migrate(configWith({ pageShortcut: "Alt+Shift+H" }))
    const twice = migrate(once)

    expect(twice).toEqual(once)
  })

  it("does not overwrite an existing translationHub config", () => {
    const oldConfig = { ...configWith(), translationHub: { shortcut: "" } }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it.each([
    ["null", null],
    ["a non-object", "config"],
    ["an array", []],
  ])("returns %s configs unchanged", (_label, oldConfig) => {
    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it("still adds the shortcut when the sibling shortcut fields are missing", () => {
    const result = migrate({ language: { targetCode: "cmn" } })

    expect(result.translationHub).toEqual({ shortcut: "Alt+Shift+H" })
  })
})
