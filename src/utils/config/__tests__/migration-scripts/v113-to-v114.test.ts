import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrate } from "../../migration-scripts/v113-to-v114"

const connection = {
  notebaseId: "notebase-1",
  notebaseNameSnapshot: "Words",
  connectedAccount: { id: "user-1", name: "Reader", email: "reader@example.com" },
  mappings: [
    {
      id: "mapping-1",
      localFieldId: "default-dictionary-term",
      notebaseColumnId: "column-term",
      notebaseColumnNameSnapshot: "Term",
    },
  ],
}

describe("v113-to-v114 migration", () => {
  it("changes nothing: v114 only allows two new optional lists", () => {
    const config = {
      selectionToolbar: { builtInActions: { dictionary: { notebaseConnection: connection } } },
    }
    expect(migrate(config)).toBe(config)
  })

  it("leaves an older connection with no skipped fields, so its unmapped fields are undecided", () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.selectionToolbar.builtInActions.dictionary.notebaseConnection =
      structuredClone(connection)

    const parsed = configSchema.safeParse(migrate(config))

    expect(parsed.success).toBe(true)
    const migrated = parsed.data?.selectionToolbar.builtInActions.dictionary.notebaseConnection
    expect(migrated?.mappings).toEqual(connection.mappings)
    expect(migrated?.skippedFieldIds).toBeUndefined()
    expect(migrated?.remindedFieldIds).toBeUndefined()
  })

  it("accepts the lists a v114 connection carries", () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.selectionToolbar.builtInActions.dictionary.notebaseConnection = {
      ...structuredClone(connection),
      skippedFieldIds: ["default-dictionary-difficulty"],
      remindedFieldIds: ["default-dictionary-phonetic"],
    }

    const parsed = configSchema.safeParse(migrate(config))

    expect(parsed.success).toBe(true)
    expect(
      parsed.data?.selectionToolbar.builtInActions.dictionary.notebaseConnection?.skippedFieldIds,
    ).toEqual(["default-dictionary-difficulty"])
  })
})
