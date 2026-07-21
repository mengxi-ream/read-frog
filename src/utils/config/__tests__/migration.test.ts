import { describe, expect, it } from "vitest"
import { CONFIG_SCHEMA_VERSION } from "@/utils/constants/config"
import { ConfigVersionTooNewError } from "../errors"
import { buildMigrationRegistry, migrateConfig } from "../migration"

const migration = (value: unknown) => value

describe("buildMigrationRegistry", () => {
  it("orders an otherwise valid contiguous chain by target version", () => {
    const first = (value: unknown) => ({ first: value })
    const second = (value: unknown) => ({ second: value })

    expect(
      buildMigrationRegistry(
        {
          "./migration-scripts/v002-to-v003.ts": second,
          "./migration-scripts/v001-to-v002.ts": first,
        },
        1,
        3,
      ),
    ).toEqual({ 2: first, 3: second })
  })

  it("rejects invalid filenames", () => {
    expect(() => buildMigrationRegistry({ "./migration-scripts/bad.ts": migration }, 1, 2)).toThrow(
      "Invalid migration filename",
    )
  })

  it("rejects an empty migration registry", () => {
    expect(() => buildMigrationRegistry({}, 1, 2)).toThrow("No config migration scripts found")
  })

  it("rejects migration files that skip a version", () => {
    expect(() =>
      buildMigrationRegistry({ "./migration-scripts/v001-to-v003.ts": migration }, 1, 3),
    ).toThrow("Invalid migration step")
  })

  it("rejects duplicate target versions before building the record", () => {
    expect(() =>
      buildMigrationRegistry(
        {
          "./one/v001-to-v002.ts": migration,
          "./two/v001-to-v002.ts": migration,
        },
        1,
        2,
      ),
    ).toThrow("Duplicate migration target version: v2")
  })

  it("rejects a discontinuous chain", () => {
    expect(() =>
      buildMigrationRegistry(
        {
          "./migration-scripts/v001-to-v002.ts": migration,
          "./migration-scripts/v003-to-v004.ts": migration,
        },
        1,
        4,
      ),
    ).toThrow("Discontinuous migration chain")
  })

  it("rejects chains with missing start or end versions", () => {
    expect(() =>
      buildMigrationRegistry({ "./migration-scripts/v002-to-v003.ts": migration }, 1, 3),
    ).toThrow("Migration chain starts at v2; expected v1")

    expect(() =>
      buildMigrationRegistry({ "./migration-scripts/v001-to-v002.ts": migration }, 1, 3),
    ).toThrow("Migration chain ends at v2; expected v3")
  })
})

describe("migrateConfig", () => {
  it("should throw ConfigVersionTooNewError when schema version is newer than current", async () => {
    const futureVersion = CONFIG_SCHEMA_VERSION + 1
    const config = {}

    await expect(migrateConfig(config, futureVersion)).rejects.toThrow(ConfigVersionTooNewError)
  })
})
