import { describe, expect, it } from "vitest"
import { createNoteSaveCompletedEvent } from "../analytics"

const COMPLETION = {
  saveSource: "custom_action" as const,
  noteCount: 1,
  path: "create_notebase" as const,
  isGuide: true,
  startedAt: 1_000,
}

describe("createNoteSaveCompletedEvent", () => {
  it("describes a save that reached the Notebase", () => {
    expect(createNoteSaveCompletedEvent(COMPLETION)).toEqual({
      feature: "note_save",
      surface: "selection_toolbar",
      startedAt: 1_000,
      provider: "unknown",
      backend_kind: "unknown",
      action_id: "save_completed",
      save_source: "custom_action",
      note_count: 1,
      path: "create_notebase",
      is_guide: true,
      outcome: "success",
    })
  })

  it("carries the failure reason of a save that did not", () => {
    expect(
      createNoteSaveCompletedEvent({ ...COMPLETION, failureReason: "note_limit" }),
    ).toMatchObject({ outcome: "failure", failure_reason: "note_limit" })
  })
})
