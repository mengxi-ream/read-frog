// @vitest-environment jsdom
import { act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetParagraphDiagnosis } from "@/utils/host/translate/paragraph-diagnosis"
import { closePageDiagnosisPanel, togglePageDiagnosisPanel } from ".."

describe("togglePageDiagnosisPanel", () => {
  beforeEach(() => {
    document.body.replaceChildren()
    resetParagraphDiagnosis()
  })

  afterEach(() => {
    act(() => closePageDiagnosisPanel())
  })

  it("follows the page into a new <body>, and the next request still closes it", async () => {
    act(() => togglePageDiagnosisPanel())
    const panelHost = document.body.lastElementChild!
    expect(panelHost.shadowRoot).not.toBeNull()

    // A client-side router swaps in a new <body>.
    const nextBody = document.createElement("body")
    document.documentElement.replaceChild(nextBody, document.body)
    await vi.waitFor(() => expect(nextBody.contains(panelHost)).toBe(true))

    act(() => togglePageDiagnosisPanel())
    expect(panelHost.isConnected).toBe(false)
  })
})
