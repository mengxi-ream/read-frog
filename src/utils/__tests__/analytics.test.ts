import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  ANALYTICS_FEATURE,
  ANALYTICS_SURFACE,
} from "@/types/analytics"

const { sendMessageMock, loggerWarnMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: loggerWarnMock,
  },
}))

const {
  buildFeatureUsedEventProperties,
  getLatencyMs,
  trackFeatureUsed,
} = await import("@/utils/analytics")

describe("analytics helpers", () => {
  beforeEach(() => {
    sendMessageMock.mockReset()
    loggerWarnMock.mockReset()
  })

  it("derives latency in milliseconds and clamps negative durations", () => {
    expect(getLatencyMs(0, 999)).toBe(999)
    expect(getLatencyMs(0, 1_500)).toBe(1_500)
    expect(getLatencyMs(10, 0)).toBe(0)
  })

  it("builds a feature_used payload with only the expected fields", () => {
    expect(buildFeatureUsedEventProperties({
      feature: ANALYTICS_FEATURE.PAGE_TRANSLATION,
      surface: ANALYTICS_SURFACE.POPUP,
      outcome: "success",
      startedAt: 0,
      finishedAt: 1_500,
    })).toEqual({
      feature: ANALYTICS_FEATURE.PAGE_TRANSLATION,
      surface: ANALYTICS_SURFACE.POPUP,
      outcome: "success",
      latency_ms: 1_500,
    })
  })

  it("tracks feature usage with the expected event payload", async () => {
    sendMessageMock.mockResolvedValue(undefined)

    const input = {
      feature: ANALYTICS_FEATURE.PAGE_TRANSLATION,
      surface: ANALYTICS_SURFACE.POPUP,
      outcome: "success" as const,
      startedAt: 0,
      finishedAt: 1_500,
    }

    await expect(trackFeatureUsed(input)).resolves.toBeUndefined()

    expect(sendMessageMock).toHaveBeenCalledOnce()
    expect(sendMessageMock).toHaveBeenCalledWith(
      "trackFeatureUsedEvent",
      buildFeatureUsedEventProperties(input),
    )
  })

  it("swallows analytics upload failures", async () => {
    sendMessageMock.mockRejectedValueOnce(new Error("upload failed"))

    await expect(trackFeatureUsed({
      feature: ANALYTICS_FEATURE.PAGE_TRANSLATION,
      surface: ANALYTICS_SURFACE.POPUP,
      outcome: "failure",
      startedAt: 0,
      finishedAt: 1_500,
    })).resolves.toBeUndefined()

    expect(loggerWarnMock).toHaveBeenCalledOnce()
  })
})
