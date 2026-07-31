import { describe, expect, it } from "vitest"
import { resolveResponsesUrl } from "../responses-url"

describe("resolveResponsesUrl", () => {
  it.each([
    ["https://api.example.com/v1", "https://api.example.com/v1/responses"],
    [" https://api.example.com/v1/ ", "https://api.example.com/v1/responses"],
    [
      "https://gateway.example.com/openai/responses",
      "https://gateway.example.com/openai/responses",
    ],
    [
      "https://gateway.example.com/openai/responses?api-version=preview",
      "https://gateway.example.com/openai/responses?api-version=preview",
    ],
    ["https://api.example.com", "https://api.example.com/responses"],
    [
      "https://api.example.com/v1/?api-version=preview",
      "https://api.example.com/v1/responses?api-version=preview",
    ],
  ])("resolves %s to %s", (baseURL, expected) => {
    expect(resolveResponsesUrl(baseURL)).toBe(expected)
  })
})
