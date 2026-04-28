import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { splitTranslatorShortcutSchema, translateConfigSchema } from "../translate"

describe("translation shortcut config validation", () => {
  it("accepts a valid split translator shortcut", () => {
    expect(splitTranslatorShortcutSchema.safeParse("Alt+S").success).toBe(true)
  })

  it("accepts an empty split translator shortcut", () => {
    expect(splitTranslatorShortcutSchema.safeParse("").success).toBe(true)
  })

  it("rejects split translator shortcuts without a modifier", () => {
    const result = splitTranslatorShortcutSchema.safeParse("S")

    expect(result.success).toBe(false)
  })

  it("accepts the default translation config", () => {
    expect(translateConfigSchema.safeParse(DEFAULT_CONFIG.translate).success).toBe(true)
  })
})
