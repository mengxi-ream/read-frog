import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v075-to-v076"

describe("v075-to-v076 migration", () => {
  it("adds presetStyle, backgroundForceMerge, lineGap, and updates defaults", () => {
    const migrated = migrate({
      videoSubtitles: {
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          main: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          translation: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          container: {
            backgroundOpacity: 75,
          },
        },
      },
    })

    expect(migrated.videoSubtitles.style).toMatchObject({
      presetStyle: 2,
      backgroundForceMerge: true,
      lineGap: 4,
      main: {
        fontShadowIntensity: 3,
        fontStrokeWidth: 3,
      },
      translation: {
        fontShadowIntensity: 3,
        fontStrokeWidth: 3,
      },
      container: {
        backgroundStyle: "blur",
      },
    })
  })

  it("preserves existing presetStyle and backgroundForceMerge values", () => {
    const migrated = migrate({
      videoSubtitles: {
        style: {
          presetStyle: 4,
          backgroundForceMerge: false,
          main: {},
          translation: {},
          container: {},
        },
      },
    })

    expect(migrated.videoSubtitles.style.presetStyle).toBe(4)
    expect(migrated.videoSubtitles.style.backgroundForceMerge).toBe(false)
  })

  it("preserves config without subtitles", () => {
    expect(migrate({})).toEqual({})
    expect(migrate({ videoSubtitles: { style: null } })).toEqual({
      videoSubtitles: { style: null },
    })
  })

  it("removes legacy mode field", () => {
    const migrated = migrate({
      videoSubtitles: {
        style: {
          mode: "basic",
          main: {},
          translation: {},
          container: {},
        },
      },
    })

    expect(migrated.videoSubtitles.style).not.toHaveProperty("mode")
  })
})
