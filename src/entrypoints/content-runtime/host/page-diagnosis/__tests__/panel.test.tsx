// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  diagnoseParagraph,
  resetParagraphDiagnosis,
} from "@/utils/host/translate/paragraph-diagnosis"
import {
  beginPageTranslationSession,
  endPageTranslationSession,
} from "@/utils/host/translate/translation-session"
import { PageDiagnosisPanel } from "../panel"

function paragraph(text: string): HTMLParagraphElement {
  const element = document.createElement("p")
  element.textContent = text
  document.body.append(element)
  return element
}

describe("page diagnosis panel", () => {
  // jsdom has no layout, so it has no scrollIntoView either.
  const scrollIntoView = vi.fn<(options?: ScrollIntoViewOptions) => void>()

  beforeEach(() => {
    document.body.replaceChildren()
    resetParagraphDiagnosis()
    scrollIntoView.mockReset()
    Element.prototype.scrollIntoView = scrollIntoView
  })

  afterEach(() => {
    endPageTranslationSession()
    vi.restoreAllMocks()
    // @ts-expect-error -- put jsdom back the way it was
    delete Element.prototype.scrollIntoView
    // @ts-expect-error -- put jsdom back the way it was
    delete Range.prototype.getClientRects
  })

  it("counts the paragraphs on the page by reason", () => {
    diagnoseParagraph([paragraph("Translated")], "Translated").translated()
    diagnoseParagraph([paragraph("已是中文")], "已是中文").untranslated("targetLanguage")
    diagnoseParagraph([paragraph("Ok")], "Ok").untranslated("tooShort")
    diagnoseParagraph([paragraph("Hi")], "Hi").untranslated("tooShort")

    render(<PageDiagnosisPanel onClose={() => {}} />)

    expect(
      screen.getAllByRole("button", { pressed: false }).map((button) => button.textContent),
    ).toEqual(["pageDiagnosis.reasons.tooShort2", "pageDiagnosis.reasons.targetLanguage1"])
  })

  it("shows verdicts that arrive while it is open", async () => {
    render(<PageDiagnosisPanel onClose={() => {}} />)
    expect(screen.getByText("pageDiagnosis.empty")).toBeInTheDocument()

    act(() => {
      diagnoseParagraph([paragraph("Failed")], "Failed").untranslated("error")
    })

    expect(await screen.findByRole("button", { name: /reasons\.error/ })).toBeInTheDocument()
    expect(screen.queryByText("pageDiagnosis.framesNotIncluded")).not.toBeInTheDocument()
  })

  it("does not ask to turn on page translation while it is on", () => {
    beginPageTranslationSession()

    render(<PageDiagnosisPanel onClose={() => {}} />)

    expect(screen.getByText("pageDiagnosis.emptyWhileTranslating")).toBeInTheDocument()
  })

  it("says that text inside frames is not included, on a page with frames", () => {
    document.body.append(document.createElement("iframe"))

    render(<PageDiagnosisPanel onClose={() => {}} />)

    expect(screen.getByText("pageDiagnosis.framesNotIncluded")).toBeInTheDocument()
  })

  it("outlines a reason's paragraphs and brings the first into view", () => {
    const element = paragraph("已是中文")
    diagnoseParagraph([element], "已是中文").untranslated("targetLanguage")
    render(<PageDiagnosisPanel onClose={() => {}} />)
    const reason = screen.getByRole("button", { name: /targetLanguage/ })

    fireEvent.click(reason)
    expect(reason).toHaveAttribute("aria-pressed", "true")
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "center", behavior: "smooth" })

    fireEvent.click(reason)
    expect(reason).toHaveAttribute("aria-pressed", "false")
  })

  it("keeps measuring its outlines after the page takes an outlined run off", async () => {
    // jsdom has no layout, so a range has no boxes to give (vitest.setup.ts
    // stubs its bounding box only), and nothing to scroll.
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList
    vi.spyOn(window, "scrollBy").mockImplementation(() => {})
    const container = document.createElement("div")
    container.innerHTML = "Read <b>the notes</b> first"
    document.body.append(container)
    diagnoseParagraph([...container.childNodes], "Read the notes first").untranslated("tooShort")
    render(<PageDiagnosisPanel onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /tooShort/ }))
    const uncaught = vi.fn<(event: ErrorEvent) => void>()
    window.addEventListener("error", uncaught)

    // The site rewrites the container, which leaves the run's own nodes with no parent.
    container.textContent = "Rewritten by the site"
    fireEvent(window, new Event("resize"))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    window.removeEventListener("error", uncaught)
    expect(uncaught).not.toHaveBeenCalled()
  })

  it("closes on Escape", () => {
    const onClose = vi.fn<() => void>()
    render(<PageDiagnosisPanel onClose={onClose} />)

    fireEvent.keyDown(window, { key: "Escape" })

    expect(onClose).toHaveBeenCalledOnce()
  })
})
