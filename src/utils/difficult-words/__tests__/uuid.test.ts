import { describe, expect, it } from "vitest"
import { uuidv7 } from "../uuid"

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("uuidv7", () => {
  it("is a version 7 UUID starting with the millisecond time", () => {
    const id = uuidv7(0x0190f5c62d0c)

    expect(id).toMatch(UUID_V7)
    expect(id.startsWith("0190f5c6-2d0c-7")).toBe(true)
  })

  it("sorts by when it was made, and differs within the same millisecond", () => {
    const earlier = uuidv7(1_700_000_000_000)
    const later = uuidv7(1_700_000_000_001)

    expect(earlier < later).toBe(true)
    expect(uuidv7(1_700_000_000_000)).not.toBe(earlier)
  })
})
