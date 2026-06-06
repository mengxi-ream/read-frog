import { describe, expect, it } from "vitest"
import { CONFIG_SCHEMA_VERSION } from "@/utils/constants/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { ConfigVersionTooNewError } from "../errors"
import { migrateConfig } from "../migration"

describe("migrateConfig", () => {
  it("should throw ConfigVersionTooNewError when schema version is newer than current", async () => {
    const futureVersion = CONFIG_SCHEMA_VERSION + 1
    const config = {}

    await expect(migrateConfig(config, futureVersion))
      .rejects
      .toThrow(ConfigVersionTooNewError)
  })

  it("adds knowledge base config when migrating from v073", async () => {
    const { knowledgeBase: _knowledgeBase, ...v073Config } = DEFAULT_CONFIG

    const migrated = await migrateConfig(v073Config, 73)

    expect(migrated.knowledgeBase).toEqual({
      enabled: true,
      captureSurfaces: [
        "page",
        "node",
        "selection",
        "input",
        "subtitles",
        "translationHub",
      ],
      remoteSync: {
        enabled: false,
        endpoint: "",
        token: "",
      },
    })
  })
})
