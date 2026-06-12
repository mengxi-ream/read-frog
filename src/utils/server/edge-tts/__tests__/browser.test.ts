import { describe, expect, it } from "vitest"
import { EDGE_TTS_SUPPORTED_BROWSERS } from "../constants"

describe("edge tts browser support", () => {
  it("allows Firefox to use background Edge TTS synthesis", () => {
    expect(EDGE_TTS_SUPPORTED_BROWSERS).toContain("firefox")
  })
})
