import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v133-to-v134"

const ALL_OFF = {
  youtube: "off",
  xcom: "off",
  netflix: "off",
  bilibili: "off",
  udemy: "off",
  edx: "off",
}

describe("v133-to-v134 migration", () => {
  it("adds Prime Video as manual when subtitles are on anywhere", () => {
    const oldConfig = {
      videoSubtitles: { platforms: { ...ALL_OFF, youtube: "auto" }, providerId: "openai-default" },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      videoSubtitles: {
        platforms: { ...ALL_OFF, youtube: "auto", primevideo: "manual" },
        providerId: "openai-default",
      },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps Prime Video off for a reader who turned subtitles off on every site", () => {
    expect(migrate({ videoSubtitles: { platforms: ALL_OFF } }).videoSubtitles.platforms).toEqual({
      ...ALL_OFF,
      primevideo: "off",
    })
  })

  it("leaves a config without platforms to the schema", () => {
    const config = { videoSubtitles: { providerId: "openai-default" } }
    expect(migrate(config)).toBe(config)
    expect(migrate(null)).toBeNull()
  })
})
