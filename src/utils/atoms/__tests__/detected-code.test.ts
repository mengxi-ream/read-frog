// @vitest-environment jsdom

import { createStore } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_DETECTED_CODE } from "@/utils/constants/config"
import { detectedCodeAtom } from "../detected-code"

const { cleanupMock, onMessageMock, sendMessageMock } = vi.hoisted(() => ({
  cleanupMock: vi.fn(),
  onMessageMock: vi.fn(),
  sendMessageMock: vi.fn(),
}))

const messageHandlers = new Map<string, (msg: any) => void>()

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
  sendMessage: sendMessageMock,
}))

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe("detectedCodeAtom", () => {
  beforeEach(() => {
    cleanupMock.mockReset()
    onMessageMock.mockReset()
    sendMessageMock.mockReset()
    messageHandlers.clear()

    onMessageMock.mockImplementation((name: string, handler: (msg: any) => void) => {
      messageHandlers.set(name, handler)
      return cleanupMock
    })
  })

  it("falls back when background returns an unsupported detected code", async () => {
    sendMessageMock.mockResolvedValue("vmw")

    const store = createStore()
    const unsubscribe = store.sub(detectedCodeAtom, () => {})
    await flushPromises()

    expect(sendMessageMock).toHaveBeenCalledWith("getDetectedCode", undefined)
    expect(store.get(detectedCodeAtom)).toBe(DEFAULT_DETECTED_CODE)

    unsubscribe()
    expect(cleanupMock).toHaveBeenCalled()
  })

  it("falls back when detected language change events carry an unsupported code", async () => {
    sendMessageMock.mockResolvedValue("jpn")

    const store = createStore()
    const unsubscribe = store.sub(detectedCodeAtom, () => {})
    await flushPromises()

    expect(store.get(detectedCodeAtom)).toBe("jpn")

    messageHandlers.get("detectedPageLanguageChanged")?.({ data: { detectedCode: "vmw" } })
    expect(store.get(detectedCodeAtom)).toBe(DEFAULT_DETECTED_CODE)

    messageHandlers.get("detectedPageLanguageChanged")?.({ data: { detectedCode: "cmn" } })
    expect(store.get(detectedCodeAtom)).toBe("cmn")

    unsubscribe()
  })
})
