// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  previewText,
  sanitizeLogFields,
  sanitizeLogMessage,
  TEXT_PREVIEW_LENGTH,
} from "../sanitize"

describe("sanitizeLogFields", () => {
  it("redacts strings under secret-looking keys, at any depth", () => {
    expect(
      sanitizeLogFields({
        apiKey: "sk-1",
        provider: { Authorization: "Bearer 2", accessToken: "3", name: "openai" },
        tokenCount: 12,
      }),
    ).toEqual({
      apiKey: "[redacted]",
      provider: { Authorization: "[redacted]", accessToken: "[redacted]", name: "openai" },
      tokenCount: 12,
    })
  })

  it("omits request content wholesale", () => {
    expect(
      sanitizeLogFields({
        body: "{}",
        messages: [{ role: "user" }],
        prompt: "Translate",
        html: "<p>",
      }),
    ).toEqual({ body: "[omitted]", messages: "[omitted]", prompt: "[omitted]", html: "[omitted]" })
  })

  it("keeps a short preview, the length and a hash of `text`", () => {
    const text = `${"word ".repeat(30)}\n\nend`
    const { text: sanitized } = sanitizeLogFields({ text }) as { text: Record<string, unknown> }

    expect(sanitized).toEqual({
      preview: expect.any(String),
      length: text.length,
      hash: expect.any(String),
    })
    expect(Array.from(sanitized.preview as string)).toHaveLength(TEXT_PREVIEW_LENGTH + 1)
    expect(sanitized.preview).toMatch(/^word word .*…$/)
    expect(sanitizeLogFields({ text })).toEqual({ text: sanitized })
    expect(previewText(`${text}!`).hash).not.toBe(sanitized.hash)
  })

  it("does not split a character when cutting the preview", () => {
    const { preview } = previewText("😀".repeat(TEXT_PREVIEW_LENGTH + 5))
    expect(preview).toBe(`${"😀".repeat(TEXT_PREVIEW_LENGTH)}…`)
  })

  it("cuts every URL to its origin", () => {
    expect(
      sanitizeLogFields({
        url: "https://kagi.com/changelog?token=abc#top",
        note: "fetched https://api.example.com/v1/keys/sk-123 then retried",
        error: new Error("GET https://api.example.com/v1/chat?key=sk-123 failed"),
      }),
    ).toEqual({
      url: "https://kagi.com",
      note: "fetched https://api.example.com then retried",
      error: expect.objectContaining({ message: "GET https://api.example.com failed" }),
    })
    expect(sanitizeLogMessage("Opened https://example.com/private/path")).toBe(
      "Opened https://example.com",
    )
  })

  it("turns errors into plain objects with their own properties and cause", () => {
    const error = Object.assign(new TypeError("Bad response"), {
      statusCode: 429,
      cause: new Error("Rate limited"),
    })

    expect(sanitizeLogFields({ error })).toEqual({
      error: {
        name: "TypeError",
        message: "Bad response",
        stack: expect.stringContaining("Bad response"),
        statusCode: 429,
        cause: expect.objectContaining({ name: "Error", message: "Rate limited" }),
      },
    })
  })

  it("recognizes errors from another realm", () => {
    const foreign = { name: "Error", message: "From the page", stack: "Error: From the page" }
    expect(sanitizeLogFields({ error: foreign })).toEqual({
      error: { name: "Error", message: "From the page", stack: "Error: From the page" },
    })
  })

  it("survives cycles, deep nesting and big collections", () => {
    const cyclic: Record<string, unknown> = { name: "root" }
    cyclic.self = cyclic
    const deep = { a: { b: { c: { d: { e: { f: "too deep" } } } } } }

    const result = sanitizeLogFields({
      cyclic,
      deep,
      items: Array.from({ length: 25 }, (_, index) => index),
      tags: new Set(["a", "b"]),
      byId: new Map([["x", 1]]),
    })

    expect(result.cyclic).toEqual({ name: "root", self: "[circular]" })
    expect(JSON.stringify(result.deep)).toContain("[…]")
    expect(result.items).toEqual([...Array.from({ length: 20 }, (_, index) => index), "… 5 more"])
    expect(result.tags).toEqual(["a", "b"])
    expect(result.byId).toEqual({ x: 1 })
  })

  it("names DOM nodes instead of walking them", () => {
    const paragraph = document.createElement("p")
    paragraph.textContent = "page text"
    expect(sanitizeLogFields({ node: paragraph, textNode: paragraph.firstChild })).toEqual({
      node: "<p>",
      textNode: "#text",
    })
  })

  it("keeps values JSON can carry and drops the rest", () => {
    expect(
      sanitizeLogFields({
        missing: undefined,
        empty: null,
        nan: Number.NaN,
        when: new Date("2026-11-11T00:00:00.000Z"),
        callback: () => {},
      }),
    ).toEqual({ empty: null, nan: "NaN", when: "2026-11-11T00:00:00.000Z", callback: "[function]" })
  })

  it("cuts long strings and oversized records short", () => {
    const { long } = sanitizeLogFields({ long: "x".repeat(400) }) as { long: string }
    expect(long).toBe(`${"x".repeat(300)}… (+100)`)

    const wide = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [`key${index}`, "y".repeat(290)]),
    )
    const result = sanitizeLogFields(wide)
    expect(Object.keys(result)).toEqual(["truncated"])
    expect((result.truncated as string).length).toBeLessThanOrEqual(8001)
  })
})
