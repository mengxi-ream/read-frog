// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { ensureXcomOverlayEntryPoint } from "../overlay-entry"

describe("x.com overlay entry point", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("places the Read Frog control just above x.com bottom player controls", () => {
    document.body.innerHTML = "<article><div data-testid=\"videoPlayer\"><video></video></div></article>"

    expect(ensureXcomOverlayEntryPoint()).toBe(true)

    const entryPoint = document.querySelector<HTMLElement>("[data-read-frog-xcom-controls=\"true\"]")

    expect(entryPoint?.style.top).toBe("auto")
    expect(entryPoint?.style.right).toBe("12px")
    expect(entryPoint?.style.bottom).toBe("72px")
  })

  it("clears stale top-right position when reusing an existing control", () => {
    document.body.innerHTML = [
      "<article>",
      "<div data-testid=\"videoPlayer\">",
      "<video></video>",
      "<div data-read-frog-xcom-controls=\"true\" style=\"top: 12px;\"></div>",
      "</div>",
      "</article>",
    ].join("")

    expect(ensureXcomOverlayEntryPoint()).toBe(true)

    const entryPoint = document.querySelector<HTMLElement>("[data-read-frog-xcom-controls=\"true\"]")

    expect(entryPoint?.style.top).toBe("auto")
    expect(entryPoint?.style.bottom).toBe("72px")
  })
})
