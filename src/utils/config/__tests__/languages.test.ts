import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_DETECTED_CODE } from "@/utils/constants/config"
import {
  getDetectedCodeFromStorage,
  normalizeDetectedCode,
  normalizeLanguageConfig,
} from "../languages"

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

describe("getDetectedCodeFromStorage", () => {
  beforeEach(() => {
    sendMessageMock.mockReset()
  })

  it("normalizes detected code values", () => {
    expect(normalizeDetectedCode("ja")).toBe("ja")
    // A code stored before languages were keyed by tag.
    expect(normalizeDetectedCode("jpn")).toBe("ja")
    expect(normalizeDetectedCode("vmw")).toBe(DEFAULT_DETECTED_CODE)
    expect(normalizeDetectedCode(null)).toBe(DEFAULT_DETECTED_CODE)
  })

  it("returns a supported detected code from background", async () => {
    sendMessageMock.mockResolvedValue("ja")

    await expect(getDetectedCodeFromStorage()).resolves.toBe("ja")
    expect(sendMessageMock).toHaveBeenCalledWith("getDetectedCode", undefined)
  })

  it("falls back when background returns an unsupported detected code", async () => {
    sendMessageMock.mockResolvedValue("vmw")

    await expect(getDetectedCodeFromStorage()).resolves.toBe(DEFAULT_DETECTED_CODE)
  })

  it("falls back when background detected code lookup fails", async () => {
    sendMessageMock.mockRejectedValue(new Error("no receiver"))

    await expect(getDetectedCodeFromStorage()).resolves.toBe(DEFAULT_DETECTED_CODE)
  })
})

describe("normalizeLanguageConfig", () => {
  it("reads the codes a content script from before tags sends as their tags", () => {
    expect(
      normalizeLanguageConfig({
        sourceCode: "eng",
        targetCode: "cmn",
        level: "intermediate",
      } as never),
    ).toEqual({ sourceCode: "en", targetCode: "zh-Hans", level: "intermediate" })
  })

  it("keeps tags and auto as they are", () => {
    expect(
      normalizeLanguageConfig({ sourceCode: "auto", targetCode: "pt-PT", level: "intermediate" }),
    ).toEqual({ sourceCode: "auto", targetCode: "pt-PT", level: "intermediate" })
  })

  it("leaves a source it cannot read to detection", () => {
    expect(
      normalizeLanguageConfig({
        sourceCode: "xx",
        targetCode: "ja",
        level: "intermediate",
      } as never),
    ).toEqual({ sourceCode: "auto", targetCode: "ja", level: "intermediate" })
  })
})
