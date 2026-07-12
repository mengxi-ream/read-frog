import { describe, expect, it } from "vitest"
import {
  assertHtmlAttributeMarkerIntegrity,
  hasHtmlAttributeMarkerProtocol,
  HTML_ATTRIBUTE_MARKER_INTEGRITY_ERROR_CODE,
  HtmlAttributeMarkerIntegrityError,
  isHtmlAttributeMarkerIntegrityError,
  parseHtmlAttributeMarkers,
} from "../html-attribute-markers"

describe("HTML attribute markers", () => {
  it("extracts marker IDs and opening tag names from complete HTML tags", () => {
    const html = [
      `marker text: data-rf-attr="outside"`,
      `<SPAN title="1 > 0" data-rf-attr = "first">Hello</SPAN>`,
      `<a DATA-RF-ATTR='second' href="/path">World</a>`,
      `<br data-rf-attr=third>`,
    ].join("")

    expect(parseHtmlAttributeMarkers(html)).toEqual([
      { id: "first", tagName: "span" },
      { id: "second", tagName: "a" },
      { id: "third", tagName: "br" },
    ])
  })

  it("ignores marker-shaped text that is not an attribute on a real opening tag", () => {
    const html = [
      `<!-- <span data-rf-attr="comment"> -->`,
      `<script>const example = '<b data-rf-attr="script">text</b>'</script>`,
      `<noscript><b data-rf-attr="noscript">text</b></noscript>`,
      `<textarea><i data-rf-attr="textarea">text</i></textarea>`,
      `<div title='<em data-rf-attr="attribute-value">'>text</div>`,
      `<![CDATA[<strong data-rf-attr="cdata">text</strong>]]>`,
      `&lt;strong data-rf-attr="escaped"&gt;`,
    ].join("")

    expect(parseHtmlAttributeMarkers(html)).toEqual([])
  })

  it("keeps scanner offsets stable around Unicode with length-changing lowercase forms", () => {
    expect(
      parseHtmlAttributeMarkers(
        `İ<style>.example { color: red }</style><span data-rf-attr="0">Text</span>`,
      ),
    ).toEqual([{ id: "0", tagName: "span" }])
  })

  it("permits marked elements to change order and attributes to change quote style", () => {
    const input =
      `<span class="name" data-rf-attr="0">Hello</span>` +
      `<a data-rf-attr='1' href="/docs">Read</a>`
    const output =
      `<a href='/docs' data-rf-attr=1>Lire</a>` +
      `<span data-rf-attr='0' class="name">Bonjour</span>`

    expect(() => assertHtmlAttributeMarkerIntegrity(input, output)).not.toThrow()
  })

  it("treats a valueless marker attribute as an empty marker ID", () => {
    expect(parseHtmlAttributeMarkers(`<span data-rf-attr>Text</span>`)).toEqual([
      { id: "", tagName: "span" },
    ])
    expect(() =>
      assertHtmlAttributeMarkerIntegrity(
        `<span data-rf-attr="0">Text</span>`,
        `<span data-rf-attr>Texte</span>`,
      ),
    ).toThrowError(expect.objectContaining({ reason: "unknown-output-marker" }))
  })

  it("distinguishes generated numeric markers from page-owned marker attributes", () => {
    expect(hasHtmlAttributeMarkerProtocol(`<span data-rf-attr="0">Text</span>`)).toBe(true)
    expect(hasHtmlAttributeMarkerProtocol(`<span data-rf-attr="12">Text</span>`)).toBe(true)
    expect(hasHtmlAttributeMarkerProtocol(`<span data-rf-attr="rf-page-0">Text</span>`)).toBe(true)
    expect(hasHtmlAttributeMarkerProtocol(`<span data-rf-attr="page-owned">Text</span>`)).toBe(
      false,
    )
    expect(
      hasHtmlAttributeMarkerProtocol(
        `<span data-rf-attr="0">Text</span><b data-rf-attr="rf-page-0">More</b>`,
      ),
    ).toBe(false)
    expect(hasHtmlAttributeMarkerProtocol(`<span>Text</span>`)).toBe(false)
  })

  it.each([
    {
      name: "duplicate IDs in the input",
      input: `<span data-rf-attr="0">One</span><b data-rf-attr="0">Two</b>`,
      output: `<span data-rf-attr="0">Un</span>`,
      reason: "duplicate-input-marker",
    },
    {
      name: "missing output IDs",
      input: `<span data-rf-attr="0">One</span><b data-rf-attr="1">Two</b>`,
      output: `<b data-rf-attr="1">Deux</b>`,
      reason: "missing-output-marker",
    },
    {
      name: "duplicate output IDs",
      input: `<span data-rf-attr="0">One</span>`,
      output: `<span data-rf-attr="0">Un</span><span data-rf-attr="0">Encore</span>`,
      reason: "duplicate-output-marker",
    },
    {
      name: "unknown output IDs",
      input: `<span data-rf-attr="0">One</span>`,
      output: `<span data-rf-attr="0">Un</span><i data-rf-attr="9">Neuf</i>`,
      reason: "unknown-output-marker",
    },
    {
      name: "a marker moved to a different tag",
      input: `<span data-rf-attr="0">One</span>`,
      output: `<div data-rf-attr="0">Un</div>`,
      reason: "wrong-output-tag",
    },
  ])("rejects $name", ({ input, output, reason }) => {
    expect(() => assertHtmlAttributeMarkerIntegrity(input, output)).toThrowError(
      expect.objectContaining({
        code: HTML_ATTRIBUTE_MARKER_INTEGRITY_ERROR_CODE,
        reason,
      }),
    )
  })

  it("recognizes integrity errors after structural cloning", () => {
    const error = new HtmlAttributeMarkerIntegrityError("missing-output-marker", "3")

    expect(isHtmlAttributeMarkerIntegrityError(error)).toBe(true)
    expect(
      isHtmlAttributeMarkerIntegrityError({
        code: HTML_ATTRIBUTE_MARKER_INTEGRITY_ERROR_CODE,
        message: error.message,
      }),
    ).toBe(true)
    expect(isHtmlAttributeMarkerIntegrityError(new Error(error.message))).toBe(false)
  })
})
