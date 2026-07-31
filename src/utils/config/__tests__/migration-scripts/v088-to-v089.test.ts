import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v088-to-v089"

function configWith({
  pageShortcut = "Alt+E",
  modeShortcut = "Alt+Shift+M",
  selectionShortcut = "Alt+T",
  videoSubtitles = { enabled: true, autoStart: false } as any,
}: {
  pageShortcut?: string
  modeShortcut?: string
  selectionShortcut?: string
  videoSubtitles?: any
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
    videoSubtitles,
  }
}

describe("v088 to v089 migration", () => {
  it("adds the primary toggle shortcut when nothing else claims it", () => {
    const result = migrate(configWith())

    expect(result.videoSubtitles.toggleShortcut).toBe("Alt+C")
  })

  it("keeps the rest of the video subtitles config untouched", () => {
    const result = migrate(
      configWith({
        videoSubtitles: { enabled: false, autoStart: true, providerId: "microsoft" },
      }),
    )

    expect(result.videoSubtitles).toEqual({
      enabled: false,
      autoStart: true,
      providerId: "microsoft",
      toggleShortcut: "Alt+C",
    })
  })

  it.each([
    ["page translation", { pageShortcut: "Alt+C" }],
    ["translation mode", { modeShortcut: "Alt+C" }],
    ["selection translation", { selectionShortcut: "Alt+C" }],
  ])("falls back when %s already uses the primary key", (_label, overrides) => {
    const result = migrate(configWith(overrides))

    expect(result.videoSubtitles.toggleShortcut).toBe("Alt+Shift+C")
  })

  it("ignores case and surrounding whitespace when detecting a collision", () => {
    const result = migrate(configWith({ modeShortcut: "  alt+c  " }))

    expect(result.videoSubtitles.toggleShortcut).toBe("Alt+Shift+C")
  })

  it("leaves the shortcut unbound when both candidates are taken", () => {
    const result = migrate(configWith({ pageShortcut: "Alt+C", modeShortcut: "Alt+Shift+C" }))

    expect(result.videoSubtitles.toggleShortcut).toBe("")
  })

  it("is idempotent", () => {
    const once = migrate(configWith({ pageShortcut: "Alt+C" }))
    const twice = migrate(once)

    expect(twice).toEqual(once)
  })

  it("does not overwrite an existing toggle shortcut", () => {
    const result = migrate(configWith({ videoSubtitles: { enabled: true, toggleShortcut: "" } }))

    expect(result.videoSubtitles.toggleShortcut).toBe("")
  })

  it.each([
    ["null", null],
    ["a non-object", "config"],
  ])("returns %s configs unchanged", (_label, oldConfig) => {
    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it("returns the config unchanged when videoSubtitles is missing", () => {
    const oldConfig = { translate: { page: {} } }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })
})
