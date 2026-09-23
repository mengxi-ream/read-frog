import type { FeatureUsedEventProperties } from "@/types/analytics"
import { beforeEach, describe, expect, it, vi } from "vitest"

type Handler = (message: {
  data: FeatureUsedEventProperties
  sender?: { tab?: { id?: number; url?: string } }
}) => Promise<unknown>

const handlers = new Map<string, Handler>()
const recordFeatureActiveDayMock = vi.fn<() => Promise<void>>()
const captureMock =
  vi.fn<
    (properties: FeatureUsedEventProperties, tab?: { id?: number; url?: string }) => Promise<void>
  >()

vi.mock("@/utils/message", () => ({
  onMessage: (key: string, handler: Handler) => {
    handlers.set(key, handler)
  },
}))

vi.mock("@/utils/feature-active-days", () => ({
  recordFeatureActiveDay: () => recordFeatureActiveDayMock(),
}))

vi.mock("../analytics", () => ({
  captureFeatureUsedEventInBackground: (
    properties: FeatureUsedEventProperties,
    tab?: { id?: number; url?: string },
  ) => captureMock(properties, tab),
}))

const { setupFeatureUsedEventHandlers } = await import("../feature-used-event")

const BASE_EVENT = {
  feature: "page_translation",
  surface: "popup",
  latency_ms: 100,
  provider: "openai",
  backend_kind: "llm",
} as const

function send(outcome: "success" | "failure", tabUrl?: string): Promise<unknown> {
  const handler = handlers.get("trackFeatureUsedEvent")
  if (!handler) throw new Error("trackFeatureUsedEvent handler was never registered")
  return handler({
    data: { ...BASE_EVENT, outcome },
    sender: tabUrl === undefined ? undefined : { tab: { id: 42, url: tabUrl } },
  })
}

describe("setupFeatureUsedEventHandlers", () => {
  beforeEach(() => {
    handlers.clear()
    recordFeatureActiveDayMock.mockReset().mockResolvedValue(undefined)
    captureMock.mockReset().mockResolvedValue(undefined)
    setupFeatureUsedEventHandlers()
  })

  it("counts an active day for a successful feature use", async () => {
    await send("success")
    expect(recordFeatureActiveDayMock).toHaveBeenCalledTimes(1)
  })

  it("does not count an active day for a failed feature use", async () => {
    await send("failure")
    expect(recordFeatureActiveDayMock).not.toHaveBeenCalled()
  })

  it("still reports a failure to analytics", async () => {
    await send("failure")
    expect(captureMock).toHaveBeenCalledWith({ ...BASE_EVENT, outcome: "failure" }, undefined)
  })

  it("fans the same event out to both consumers", async () => {
    await send("success")
    expect(recordFeatureActiveDayMock).toHaveBeenCalledTimes(1)
    expect(captureMock).toHaveBeenCalledWith({ ...BASE_EVENT, outcome: "success" }, undefined)
  })

  it("does not wait on the active-day write before reporting to analytics", async () => {
    // A write that never settles stands in for a slow one. If the handler awaited it
    // instead of firing and forgetting, this send would hang and the test would time out.
    recordFeatureActiveDayMock.mockReturnValue(new Promise<void>(() => {}))

    await send("success")

    expect(captureMock).toHaveBeenCalledTimes(1)
  })

  it("hands the sender tab to analytics without interpreting it", async () => {
    await send("success", "https://mail.google.com/mail/u/0/#inbox/abc?x=1")
    expect(captureMock).toHaveBeenCalledWith(
      { ...BASE_EVENT, outcome: "success" },
      { id: 42, url: "https://mail.google.com/mail/u/0/#inbox/abc?x=1" },
    )
  })
})
