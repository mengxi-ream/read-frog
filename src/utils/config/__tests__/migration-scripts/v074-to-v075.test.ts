import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v074-to-v075"

describe("v074-to-v075 migration", () => {
  it("renames legacy Notebase connection fields to current names", () => {
    const migrated = migrate({
      selectionToolbar: {
        customActions: [
          {
            id: "action-1",
            notebaseConnection: {
              tableId: "notebase-1",
              tableNameSnapshot: "Articles",
              mappings: [
                {
                  id: "mapping-1",
                  localFieldId: "field-summary",
                  remoteColumnId: "column-summary",
                  remoteColumnNameSnapshot: "Summary",
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

  it("prefers existing current fields over legacy fallback fields", () => {
    const migrated = migrate({
      selectionToolbar: {
        customActions: [
          {
            id: "action-1",
            notebaseConnection: {
              tableId: "legacy-notebase",
              tableNameSnapshot: "Legacy Articles",
              notebaseId: "current-notebase",
              notebaseNameSnapshot: "Current Articles",
              mappings: [
                {
                  id: "mapping-1",
                  localFieldId: "field-summary",
                  remoteColumnId: "legacy-column",
                  remoteColumnNameSnapshot: "Legacy Summary",
                  notebaseColumnId: "current-column",
                  notebaseColumnNameSnapshot: "Current Summary",
                },
              ],
            },
          },
        ],
      },
    })

    expect(migrated.selectionToolbar.customActions[0].notebaseConnection).toEqual({
      notebaseId: "current-notebase",
      notebaseNameSnapshot: "Current Articles",
      mappings: [
        {
          id: "mapping-1",
          localFieldId: "field-summary",
          notebaseColumnId: "current-column",
          notebaseColumnNameSnapshot: "Current Summary",
        },
      ],
    })
  })

  it("preserves config without custom actions or malformed connection shapes", () => {
    expect(migrate({})).toEqual({})
    expect(migrate({ selectionToolbar: { customActions: null } })).toEqual({
      selectionToolbar: { customActions: null },
    })
    expect(migrate({
      selectionToolbar: {
        customActions: [
          "bad-action",
          {
            id: "action-1",
            notebaseConnection: "bad-connection",
          },
        ],
      },
    })).toEqual({
      selectionToolbar: {
        customActions: [
          "bad-action",
          {
            id: "action-1",
            notebaseConnection: "bad-connection",
          },
        ],
      },
    })
  })
})
