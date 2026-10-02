// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"
import {
  clearAppliedDocumentTitleTranslation,
  getSourceDocumentTitle,
  setAppliedDocumentTitleTranslation,
} from "../document-title"

describe("getSourceDocumentTitle", () => {
  beforeEach(() => {
    clearAppliedDocumentTitleTranslation()
    document.title = "Original Title"
  })

  it("reads the document title when no translation has been applied", () => {
    expect(getSourceDocumentTitle()).toBe("Original Title")
  })

  it("returns the page's own title while the tab shows the translation", () => {
    setAppliedDocumentTitleTranslation("Original Title", "Translated Title")
    document.title = "Translated Title"

    expect(getSourceDocumentTitle()).toBe("Original Title")
  })

  it("follows a title the page sets after the translation was applied", () => {
    setAppliedDocumentTitleTranslation("Original Title", "Translated Title")
    document.title = "Next Page Title"

    expect(getSourceDocumentTitle()).toBe("Next Page Title")
  })

  it("reads the document title again once the translation is cleared", () => {
    setAppliedDocumentTitleTranslation("Original Title", "Translated Title")
    document.title = "Translated Title"
    clearAppliedDocumentTitleTranslation()

    expect(getSourceDocumentTitle()).toBe("Translated Title")
  })
})
