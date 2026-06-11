import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v075-to-v076"

describe("v075-to-v076 migration", () => {
  it("backfills a migrated account snapshot on existing Notebase connections", () => {
    const migrated = migrate({
      selectionToolbar: {
        customActions: [
          {
            id: "action-1",
            notebaseConnection: {
              notebaseId: "notebase-1",
              notebaseNameSnapshot: "Articles",
              mappings: [
                {
                  id: "mapping-1",
                  localFieldId: "field-summary",
                  notebaseColumnId: "column-summary",
                  notebaseColumnNameSnapshot: "Summary",
                },
              ],
            },
          },
        ],
      },
    })

    expect(migrated.selectionToolbar.customActions[0].notebaseConnection).toEqual({
      notebaseId: "notebase-1",
      notebaseNameSnapshot: "Articles",
      connectedAccount: {
        id: "__read_frog_migrated_notebase_connection__",
        name: "Migrated Notebase connection",
        email: "migrated-notebase-connection@readfrog.local",
        image: null,
      },
      mappings: [
        {
          id: "mapping-1",
          localFieldId: "field-summary",
          notebaseColumnId: "column-summary",
          notebaseColumnNameSnapshot: "Summary",
        },
      ],
    })
  })
})
