import { describe, expect, it } from "vitest"
import { resolveModelId } from "../model-id"

describe("resolveModelId", () => {
  it("returns a trimmed built-in model id", () => {
    expect(resolveModelId({
      isCustomModel: false,
      model: " gpt-4.1-mini ",
      customModel: "",
    } as unknown as Parameters<typeof resolveModelId>[0])).toBe("gpt-4.1-mini")
  })

  it("returns a trimmed custom model id", () => {
    expect(resolveModelId({
      isCustomModel: true,
      model: "",
      customModel: " custom-model ",
    } as unknown as Parameters<typeof resolveModelId>[0])).toBe("custom-model")
  })

  it("returns undefined when the selected field is empty", () => {
    expect(resolveModelId({
      isCustomModel: true,
      model: "ignored",
      customModel: undefined,
    } as unknown as Parameters<typeof resolveModelId>[0])).toBeUndefined()
  })
})
