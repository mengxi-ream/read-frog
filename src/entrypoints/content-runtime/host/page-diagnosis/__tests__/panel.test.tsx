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
    // @ts-expect-error -- put jsdom back the way it was
    delete Element.prototype.scrollIntoView
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

  it("closes on Escape", () => {
    const onClose = vi.fn<() => void>()
    render(<PageDiagnosisPanel onClose={onClose} />)

    fireEvent.keyDown(window, { key: "Escape" })

    expect(onClose).toHaveBeenCalledOnce()
  })
})
