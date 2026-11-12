// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { captureLogs, loggedError, logRecord } from "@/utils/logging/testing"
import {
  diagnoseParagraph,
  getDiagnosedParagraphs,
  logSessionSummary,
  resetParagraphDiagnosis,
  settleDisplayedTranslation,
  subscribeParagraphDiagnosis,
} from "../paragraph-diagnosis"
import { beginPageTranslationSession, endPageTranslationSession } from "../translation-session"

function paragraph(text: string): HTMLParagraphElement {
  const element = document.createElement("p")
  element.textContent = text
  document.body.append(element)
  return element
}

function verdicts() {
  return getDiagnosedParagraphs().map(({ first, verdict }) => [first.textContent, verdict])
}

describe("paragraph diagnosis", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ""
    resetParagraphDiagnosis()
    beginPageTranslationSession()
  })

  afterEach(() => {
    endPageTranslationSession()
    vi.useRealTimers()
  })

  it("keeps the first verdict a paragraph gets", () => {
    const element = paragraph("Hello there")
    const diagnosis = diagnoseParagraph([element], "Hello there")

    diagnosis.untranslated("noTranslationNeeded")
    diagnosis.untranslated("emptyResult")
    diagnosis.translated()

    expect(verdicts()).toEqual([["Hello there", "noTranslationNeeded"]])
  })

  it("replaces a paragraph's verdict when it is translated again", () => {
    const element = paragraph("Hello there")

    diagnoseParagraph([element], "Hello there").untranslated("error")
    diagnoseParagraph([element], "Hello there").translated()

    expect(verdicts()).toEqual([["Hello there", "translated"]])
  })

  it("tells apart paragraphs that share an anchor", () => {
    const container = paragraph("First\n\nSecond")

    diagnoseParagraph([container], "First", "unit:0").translated()
    diagnoseParagraph([container], "Second", "unit:1").untranslated("tooShort")

    expect(getDiagnosedParagraphs().map(({ verdict }) => verdict)).toEqual([
      "translated",
      "tooShort",
    ])
  })

  it("keeps the first and last node of a run, and skips paragraphs no longer on the page", () => {
    const container = paragraph("")
    container.innerHTML = "Kept <b>text</b> here"
    const run = [...container.childNodes]
    const removed = paragraph("Removed text")

    diagnoseParagraph(run, "Kept text here").translated()
    diagnoseParagraph([removed], "Removed text").translated()
    removed.remove()

    expect(getDiagnosedParagraphs()).toEqual([
      { key: expect.any(String), verdict: "translated", first: run[0], last: run.at(-1) },
    ])
  })

  it("gives a run with no visible text no verdict", () => {
    const logs = captureLogs()
    const gap = document.createTextNode("\n    ")
    document.body.append(gap)

    diagnoseParagraph([gap], "\n    ").untranslated("noProse")
    vi.advanceTimersByTime(10_000)

    expect(getDiagnosedParagraphs()).toEqual([])
    expect(logs).toEqual([])
  })

  it("logs paragraphs that point at a problem, a few per reason", () => {
    const logs = captureLogs()
    const error = new Error("429 Too Many Requests")

    for (let index = 0; index < 12; index++) {
      diagnoseParagraph([paragraph(`Paragraph ${index}`)], `Paragraph ${index}`).untranslated(
        "error",
        {
          error,
        },
      )
    }
    diagnoseParagraph([paragraph("Short")], "Short").untranslated("tooShort")

    const warnings = logs.filter((record) => record.level === "warn")
    expect(warnings).toHaveLength(10)
    expect(warnings[0]).toEqual(
      logRecord("warn", "Paragraph not translated", {
        reason: "error",
        text: expect.objectContaining({ preview: "Paragraph 0" }),
        error: loggedError("429 Too Many Requests"),
      }),
    )
  })

  it("logs a summary of the session once it goes quiet, and only when it changed", () => {
    const logs = captureLogs("info")

    diagnoseParagraph([paragraph("One")], "One").translated()
    diagnoseParagraph([paragraph("Two")], "Two").untranslated("noTranslationNeeded")
    expect(logs).toEqual([])

    vi.advanceTimersByTime(10_000)
    expect(logs).toEqual([
      logRecord("info", "Page translation outcome", {
        counts: { noTranslationNeeded: 1, translated: 1 },
        samples: { noTranslationNeeded: [{ text: expect.objectContaining({ preview: "Two" }) }] },
      }),
    ])

    logSessionSummary()
    expect(logs).toHaveLength(1)
  })

  it("closes the previous session's summary when a new session starts", () => {
    const logs = captureLogs("info")
    diagnoseParagraph([paragraph("Old")], "Old").translated()

    endPageTranslationSession()
    beginPageTranslationSession()
    diagnoseParagraph([paragraph("New")], "New").untranslated("tooShort")

    expect(logs).toEqual([
      logRecord("info", "Page translation outcome", { counts: { translated: 1 } }),
    ])
    expect(verdicts()).toEqual([["New", "tooShort"]])
  })

  it("tells subscribers about every verdict", () => {
    const listener = vi.fn<() => void>()
    const unsubscribe = subscribeParagraphDiagnosis(listener)

    diagnoseParagraph([paragraph("One")], "One").translated()
    unsubscribe()
    diagnoseParagraph([paragraph("Two")], "Two").translated()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  describe("settleDisplayedTranslation", () => {
    it.each([
      ["a translation is shown", "Bonjour", "Bonjour", "translated"],
      ["the translation repeats the original", "Hello", "", "sameAsSource"],
      ["nothing came back", "", "", "emptyResult"],
    ])("records when %s", (_, returned, displayed, verdict) => {
      const diagnosis = diagnoseParagraph([paragraph("Hello")], "Hello")

      settleDisplayedTranslation(diagnosis, returned, displayed)

      expect(verdicts()).toEqual([["Hello", verdict]])
    })

    it("leaves a failed or abandoned request without a verdict", () => {
      settleDisplayedTranslation(
        diagnoseParagraph([paragraph("Hello")], "Hello"),
        undefined,
        undefined,
      )

      expect(verdicts()).toEqual([])
    })

    it("keeps the reason an earlier step gave for an empty answer", () => {
      const diagnosis = diagnoseParagraph([paragraph("Hello")], "Hello")
      diagnosis.untranslated("skipLanguage")

      settleDisplayedTranslation(diagnosis, "", "")

      expect(verdicts()).toEqual([["Hello", "skipLanguage"]])
    })
  })
})
