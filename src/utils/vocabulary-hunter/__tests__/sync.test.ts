import { describe, expect, it } from "vitest"
import { readWordHunterBackup } from "../sync"

describe("readWordHunterBackup", () => {
  it("reads a regular Word Hunter backup", () => {
    expect(
      readWordHunterBackup(JSON.stringify({ known: { activity: "o", workflow: "o" } })),
    ).toEqual(["activity", "workflow"])
  })

  it("reads a downloaded Gist response and legacy word map", () => {
    const gist = {
      files: {
        "word_hunter_backup.json": {
          content: JSON.stringify({ known: { license: "o" } }),
        },
      },
    }
    expect(readWordHunterBackup(JSON.stringify(gist))).toEqual(["license"])
    expect(readWordHunterBackup(JSON.stringify({ modernize: "o" }))).toEqual(["modernize"])
  })
})
