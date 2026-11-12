// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

const OWN_ORIGIN = "chrome-extension://abcdefgh/"

async function setUp(options?: { ownOrigin?: string }) {
  // Fresh modules stand in for another bundle, and the capture must use the
  // same logger copy as the code under test.
  vi.resetModules()
  const { captureLogs } = await import("../testing")
  const { captureUncaughtErrors } = await import("../uncaught")
  const logs = captureLogs()
  captureUncaughtErrors(options)
  return logs
}

function dispatchError(init: ErrorEventInit) {
  window.dispatchEvent(new ErrorEvent("error", init))
}

function dispatchRejection(reason: unknown) {
  const event = new Event("unhandledrejection") as Event & { reason: unknown }
  event.reason = reason
  window.dispatchEvent(event)
}

describe("captureUncaughtErrors", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("logs errors nothing caught", async () => {
    const logs = await setUp()

    dispatchError({
      error: new Error("Boom"),
      message: "Uncaught Error: Boom",
      filename: `${OWN_ORIGIN}options.js`,
      lineno: 3,
      colno: 7,
    })
    dispatchRejection(new Error("Rejected"))

    expect(logs).toEqual([
      expect.objectContaining({
        level: "error",
        scope: "uncaught",
        message: "Uncaught error",
        fields: {
          error: expect.objectContaining({ message: "Boom" }),
          source: `${OWN_ORIGIN}options.js:3:7`,
        },
      }),
      expect.objectContaining({
        message: "Unhandled promise rejection",
        fields: { error: expect.objectContaining({ message: "Rejected" }) },
      }),
    ])
  })

  it("leaves the site's own errors alone in a content script", async () => {
    const logs = await setUp({ ownOrigin: OWN_ORIGIN })

    dispatchError({ error: new Error("Site bug"), filename: "https://example.com/app.js" })
    dispatchRejection(
      Object.assign(new Error("Site rejection"), { stack: "at https://example.com/app.js:1:1" }),
    )
    dispatchRejection("a string with no stack")
    dispatchError({ error: new Error("Ours"), filename: `${OWN_ORIGIN}content-runtime.js` })
    dispatchRejection(
      Object.assign(new Error("Our rejection"), {
        stack: `at ${OWN_ORIGIN}content-runtime.js:9:1`,
      }),
    )

    expect(logs.map((record) => (record.fields.error as { message: string }).message)).toEqual([
      "Ours",
      "Our rejection",
    ])
  })

  it("stores an error once, however many bundles in the frame set up logging", async () => {
    const firstBundle = await setUp({ ownOrigin: OWN_ORIGIN })
    const secondBundle = await setUp({ ownOrigin: OWN_ORIGIN })

    dispatchError({
      error: new Error("Boom"),
      filename: `${OWN_ORIGIN}content-scripts/subtitles.js`,
    })

    expect(firstBundle).toEqual([])
    expect(secondBundle).toEqual([expect.objectContaining({ message: "Uncaught error" })])
  })

  it("ignores the ResizeObserver loop notice", async () => {
    const logs = await setUp()

    dispatchError({ message: "ResizeObserver loop completed with undelivered notifications." })

    expect(logs).toEqual([])
  })
})
