import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import {
  GOOGLE_TRANSLATE_PROVIDER_ID,
  MICROSOFT_TRANSLATE_PROVIDER_ID,
} from "@/utils/constants/providers"

const isGoogleTranslateReachableMock = vi.fn<() => Promise<boolean>>()

vi.mock("@/utils/host/translate/api/google", () => ({
  isGoogleTranslateReachable: isGoogleTranslateReachableMock,
}))

const { getFreeTranslateProviderId } = await import("../free-translate-provider")

describe("getFreeTranslateProviderId", () => {
  beforeEach(() => {
    fakeBrowser.reset()
    isGoogleTranslateReachableMock.mockReset()
  })

  it("picks Google where the probe reaches it", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(true)

    await expect(getFreeTranslateProviderId()).resolves.toBe(GOOGLE_TRANSLATE_PROVIDER_ID)
  })

  it("falls back to Microsoft where Google is blocked", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)

    await expect(getFreeTranslateProviderId()).resolves.toBe(MICROSOFT_TRANSLATE_PROVIDER_ID)
  })

  it("probes once a session", async () => {
    isGoogleTranslateReachableMock.mockResolvedValue(false)

    await getFreeTranslateProviderId()
    isGoogleTranslateReachableMock.mockResolvedValue(true)

    await expect(getFreeTranslateProviderId()).resolves.toBe(MICROSOFT_TRANSLATE_PROVIDER_ID)
    expect(isGoogleTranslateReachableMock).toHaveBeenCalledTimes(1)
  })
})
