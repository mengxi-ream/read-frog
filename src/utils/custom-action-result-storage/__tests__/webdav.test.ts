import type { CustomActionResultRecord, WebDavStorageSettings } from "../types"
import { describe, expect, it, vi } from "vitest"
import {
  CustomActionResultStorageProviderError,
  CustomActionResultWebDavProvider,
  parseWebDavMultistatus,
} from "../webdav"

const RECORD_ID = "11111111-1111-4111-8111-111111111111"
const RECORD: CustomActionResultRecord = {
  id: RECORD_ID,
  schemaVersion: 1,
  customActionId: "dictionary-action",
  customActionName: "Dictionary",
  fields: {
    word: "sonder",
    extraNestedField: { confidence: 0.92, labels: ["rare", "literary"] },
    unrecognizedField: "kept intact",
  },
  sourceUrl: "https://example.com/article",
  sourceTitle: "An article",
  createdAt: 100,
  updatedAt: 100,
}

const SETTINGS: WebDavStorageSettings = {
  serverUrl: "https://dav.example.test/dav/base",
  directory: "Read Frog/Words",
  username: "reader",
  password: "app-password",
}

function response(status: number, body?: string, headers?: HeadersInit) {
  return new Response(body ?? null, { status, headers })
}

const listXml = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response><d:href>/dav/base/Read%20Frog/Words/</d:href></d:response>
  <d:response><d:href>/dav/base/Read%20Frog/Words/rf-entry-${RECORD_ID}.json</d:href></d:response>
  <d:response><d:href>/dav/base/Read%20Frog/Words/notes.txt</d:href></d:response>
</d:multistatus>`

describe("CustomActionResultWebDavProvider", () => {
  it("creates nested directories, writes one JSON file per record, lists PROPFIND results, and deletes", async () => {
    const calls: Array<{ url: URL; method: string; headers: Headers; body?: string }> = []
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const inputUrl =
        input instanceof URL ? input.href : input instanceof Request ? input.url : input
      const url = new URL(inputUrl)
      const method = init?.method ?? "GET"
      const headers = new Headers(init?.headers)
      calls.push({
        url,
        method,
        headers,
        body: typeof init?.body === "string" ? init.body : undefined,
      })

      if (method === "MKCOL") return response(201)
      if (method === "PUT" || method === "DELETE") return response(204)
      if (method === "PROPFIND")
        return response(207, listXml, { "Content-Type": "application/xml" })
      if (method === "GET") {
        return response(200, JSON.stringify(RECORD), { "Content-Type": "application/json" })
      }
      return response(405)
    })

    const provider = new CustomActionResultWebDavProvider(SETTINGS, fetcher)
    await provider.save([RECORD])

    const mkcolCalls = calls.filter((call) => call.method === "MKCOL")
    expect(mkcolCalls.map(({ url }) => url.pathname)).toEqual([
      "/dav/base/Read%20Frog/",
      "/dav/base/Read%20Frog/Words/",
    ])
    const putCall = calls.find((call) => call.method === "PUT")
    expect(putCall?.url.pathname).toBe(`/dav/base/Read%20Frog/Words/rf-entry-${RECORD_ID}.json`)
    expect(JSON.parse(putCall?.body ?? "{}")).toEqual(RECORD)
    expect(putCall?.headers.get("Authorization")).toBe("Basic cmVhZGVyOmFwcC1wYXNzd29yZA==")
    expect(putCall?.url.href).not.toContain(SETTINGS.password)

    expect(await provider.list()).toEqual([RECORD])
    await provider.delete(RECORD_ID)
    expect(
      calls.some((call) => call.method === "PROPFIND" && call.headers.get("Depth") === "1"),
    ).toBe(true)
    expect(
      calls.some(
        (call) => call.method === "DELETE" && call.url.pathname.endsWith(`${RECORD_ID}.json`),
      ),
    ).toBe(true)
  })

  it("parses namespace-prefixed DAV responses and XML entities", () => {
    expect(
      parseWebDavMultistatus(
        '<d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/A&amp;B/</d:href></d:response></d:multistatus>',
      ),
    ).toEqual(["/dav/A&B/"])
  })

  it("reports safe authentication errors without exposing credentials", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response(401))
    const provider = new CustomActionResultWebDavProvider(SETTINGS, fetcher)

    let caught: unknown
    try {
      await provider.testConnection()
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(CustomActionResultStorageProviderError)
    expect(caught).toMatchObject({ code: "unauthorized" })
    expect(String(caught)).not.toContain(SETTINGS.password)
    expect(String(caught)).not.toContain("Authorization")
  })

  it("requires HTTPS except for explicitly configured loopback addresses", () => {
    const fetcher = vi.fn<typeof fetch>(async () => response(207, listXml))

    expect(
      () =>
        new CustomActionResultWebDavProvider(
          { ...SETTINGS, serverUrl: "http://dav.example.test/dav" },
          fetcher,
        ),
    ).toThrowError(expect.objectContaining({ code: "http_not_local" }))

    expect(
      () =>
        new CustomActionResultWebDavProvider(
          { ...SETTINGS, serverUrl: "http://127.0.0.1:8080/dav" },
          fetcher,
        ),
    ).not.toThrow()
  })
})
