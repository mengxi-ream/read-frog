import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v099-to-v100"

/** A stored v099 subtitle style: everything the editor sets, and no `customCSS`. Typed `any` like
 * the migration it feeds — this is a stored shape, not the current schema. */
function configWithSubtitleStyle(): any {
  return {
    uiLanguage: "zh-CN",
    videoSubtitles: {
      enabled: true,
      providerId: "microsoft-translate-default",
      style: {
        displayMode: "bilingual",
        translationPosition: "above",
        main: { fontFamily: "system", fontScale: 100, color: "#FFFFFF", fontWeight: 400 },
        translation: { fontFamily: "roboto", fontScale: 120, color: "#FFDD00", fontWeight: 500 },
        container: { backgroundOpacity: 70 },
      },
      position: { percent: 10, anchor: "bottom" },
    },
  }
}

describe("v099 to v100 migration", () => {
  it("adds customCSS as null", () => {
    expect(migrate(configWithSubtitleStyle()).videoSubtitles.style.customCSS).toBeNull()
  })

  it("leaves every other style field untouched", () => {
    const before = configWithSubtitleStyle()
    const migrated = migrate(before)

    expect(migrated.videoSubtitles.style).toEqual({
      ...before.videoSubtitles.style,
      customCSS: null,
    })
    expect(migrated.videoSubtitles.position).toEqual(before.videoSubtitles.position)
    expect(migrated.uiLanguage).toBe("zh-CN")
  })

  it("is idempotent, and keeps CSS a re-run would otherwise clear", () => {
    const withCSS = configWithSubtitleStyle()
    withCSS.videoSubtitles.style.customCSS = ".subtitles-main{opacity:0.6}"

    const migrated = migrate(withCSS)

    expect(migrated).toBe(withCSS)
    expect(migrated.videoSubtitles.style.customCSS).toBe(".subtitles-main{opacity:0.6}")
  })

  it("returns configs it cannot place the field in untouched", () => {
    for (const config of [null, undefined, "nope", {}, { videoSubtitles: {} }]) {
      expect(migrate(config)).toBe(config)
    }
  })
})
