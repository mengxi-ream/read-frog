// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  previewText,
  redactSecrets,
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

  it("keeps no part of a local file's path, and the extension's own URLs whole", () => {
    // Chrome's words when it keeps the extension out of a framed local page.
    const error = new Error(
      'Cannot access contents of url "file:///Users/jane/Documents/statement.html". Extension manifest must request permission to access this host.',
    )
    error.stack = `Error: ${error.message}\n    at injectFrame (chrome-extension://abcdefgh/background.js:12:3)`

    expect(
      sanitizeLogFields({ error, socket: "wss://speech.example.com/v1/stream?key=sk-1" }),
    ).toEqual({
      error: {
        name: "Error",
        message:
          'Cannot access contents of url "file:///[path]". Extension manifest must request permission to access this host.',
        stack: "    at injectFrame (chrome-extension://abcdefgh/background.js:12:3)",
      },
      socket: "wss://speech.example.com",
    })
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
        stack: expect.stringMatching(/^ {4}at /),
        statusCode: 429,
        cause: expect.objectContaining({ name: "Error", message: "Rate limited" }),
      },
    })
  })

  it("recognizes errors from another realm", () => {
    const foreign = {
      name: "Error",
      message: "From the page",
      stack: "Error: From the page\n    at https://example.com/app.js:1:1",
    }
    expect(sanitizeLogFields({ error: foreign })).toEqual({
      error: { name: "Error", message: "From the page", stack: "    at https://example.com" },
    })
  })

  it("keeps a long message once, capped, and of the stack only the frames", () => {
    // V8 opens a stack with the whole message, however long it is.
    const pageText = "Balance for 123-45-6789: $12,930.22. ".repeat(20)
    const error = new Error(`Batch failed.\n${pageText}`)

    const { error: sanitized } = sanitizeLogFields({ error }) as {
      error: { message: string; stack: string }
    }

    expect(sanitized.message).toMatch(/^Batch failed\.\n.*… \(\+\d+\)$/s)
    expect(sanitized.stack).toMatch(/^ {4}at /)
    expect(sanitized.stack).not.toContain("123-45-6789")
  })

  it("drops the opening of a stack written before the message was shortened", () => {
    const error = new Error("Bad response: Bonjour à tous")
    // V8 writes the stack when it is first read.
    expect(error.stack).toContain("Bonjour")
    error.message = "Bad response"

    const { error: sanitized } = sanitizeLogFields({ error }) as {
      error: { message: string; stack: string }
    }

    expect(sanitized.message).toBe("Bad response")
    expect(sanitized.stack).toMatch(/^ {4}at /)
    expect(sanitized.stack).not.toContain("Bonjour")
  })

  it("keeps nothing of a stack that holds only its opening", () => {
    const error = {
      name: "Error",
      message: "Balance for 123-45-6789",
      stack: "Error: Balance for 123-45-6789",
    }
    expect(sanitizeLogFields({ error })).toEqual({
      error: { name: "Error", message: "Balance for 123-45-6789" },
    })
  })

  it("keeps a stack that lists frames only, as Firefox and Safari write it", () => {
    const error = {
      name: "TypeError",
      message: "translate is undefined",
      stack: "translate@moz-extension://abcdefgh/background.js:10:5\n",
    }
    expect(sanitizeLogFields({ error })).toEqual({ error })
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

describe("redactSecrets", () => {
  it("removes keys and tokens but keeps the rest of the settings as they are", () => {
    expect(
      redactSecrets({
        providersConfig: [
          {
            id: "deeplx",
            apiKey: "sk-1",
            baseURL: "https://deeplx.example.com/abc123secret/translate?token=abc123",
            headers: { "Ocp-Apim-Subscription-Key": "key-2", "X-Empty": "" },
          },
          { id: "open-responses", url: "https://llm.example.com/v1/responses?key=3" },
          { id: "openai", apiKey: "", baseURL: "https://api.openai.com/v1" },
        ],
        siteControl: { patterns: ["https://example.com/docs/*"] },
      }),
    ).toEqual({
      providersConfig: [
        {
          id: "deeplx",
          apiKey: "[redacted]",
          baseURL: "https://deeplx.example.com",
          headers: { "Ocp-Apim-Subscription-Key": "[redacted]", "X-Empty": "" },
        },
        { id: "open-responses", url: "https://llm.example.com" },
        { id: "openai", apiKey: "", baseURL: "https://api.openai.com" },
      ],
      siteControl: { patterns: ["https://example.com/docs/*"] },
    })
  })

  it("redacts a service address it cannot read as a web address", () => {
    expect(redactSecrets({ baseURL: "deeplx.example.com/abc123secret" })).toEqual({
      baseURL: "[redacted]",
    })
  })
})
