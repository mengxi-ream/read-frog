import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_DETECTED_CODE } from "@/utils/constants/config"
import { getDetectedCodeFromStorage, normalizeDetectedCode } from "../languages"

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

describe("getDetectedCodeFromStorage", () => {
  beforeEach(() => {
    sendMessageMock.mockReset()
  })

  it("normalizes detected code values", () => {
    expect(normalizeDetectedCode("jpn")).toBe("jpn")
    expect(normalizeDetectedCode("vmw")).toBe(DEFAULT_DETECTED_CODE)
    expect(normalizeDetectedCode(null)).toBe(DEFAULT_DETECTED_CODE)
  })

  it("returns a supported detected code from background", async () => {
    sendMessageMock.mockResolvedValue("jpn")

    await expect(getDetectedCodeFromStorage()).resolves.toBe("jpn")
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
