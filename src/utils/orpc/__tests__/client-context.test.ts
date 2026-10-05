import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { DEFAULT_ANALYTICS_ENABLED } from "@/utils/constants/analytics"
import { buildExtensionORPCHeaders } from "../client-context"

const ANALYTICS_CONTEXT = { analytics: { surface: "note_suggestion" as const, isGuide: true } }

function mockAnalyticsSwitch(value: unknown) {
  storage.getItem = vi.fn<(...args: any[]) => any>(() => Promise.resolve(value))
}

describe("buildExtensionORPCHeaders", () => {
  beforeEach(() => {
    mockAnalyticsSwitch(true)
  })

  it("only identifies the extension on calls without analytics context", async () => {
    await expect(buildExtensionORPCHeaders(undefined)).resolves.toEqual({
      "x-orpc-source": "extension",
    })
    await expect(buildExtensionORPCHeaders({})).resolves.toEqual({
      "x-orpc-source": "extension",
    })
  })

  it("adds the analytics context while the analytics switch is on", async () => {
    await expect(buildExtensionORPCHeaders(ANALYTICS_CONTEXT)).resolves.toEqual({
      "x-orpc-source": "extension",
      "x-read-frog-client-context": "surface=note_suggestion, guide",
    })
  })

  it("leaves the analytics context out once the user turned analytics off", async () => {
    mockAnalyticsSwitch(false)

    await expect(buildExtensionORPCHeaders(ANALYTICS_CONTEXT)).resolves.toEqual({
      "x-orpc-source": "extension",
    })
  })

  it("follows the browser default when the switch was never set", async () => {
    mockAnalyticsSwitch(undefined)

    const headers = await buildExtensionORPCHeaders(ANALYTICS_CONTEXT)

    expect("x-read-frog-client-context" in headers).toBe(DEFAULT_ANALYTICS_ENABLED)
  })

  it("sends no analytics context when the switch cannot be read", async () => {
    storage.getItem = vi.fn<(...args: any[]) => any>(() => Promise.reject(new Error("no storage")))

    await expect(buildExtensionORPCHeaders(ANALYTICS_CONTEXT)).resolves.toEqual({
      "x-orpc-source": "extension",
    })
  })
})
