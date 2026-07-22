import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchGoogleModels } from "../google-models"

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("fetchGoogleModels", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("discovers arbitrary future models without a version allowlist", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        models: [
          {
            name: "models/gemini-42-flash",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/gemini-100-flash-lite",
            supportedGenerationMethods: ["countTokens", "generateContent"],
          },
          {
            name: "models/gemini-42-flash",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/gemini-102-flash",
            supportedGenerationMethods: ["countTokens"],
          },
          {
            name: "models/gemma-103-it",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }),
    )

    await expect(
      fetchGoogleModels({
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
        apiKey: "test-key",
      }),
    ).resolves.toEqual(["gemini-100-flash-lite", "gemini-42-flash"])
  })

  it("paginates the official endpoint and sends the API key header", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          models: [
            {
              name: "models/gemini-20-flash",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
          nextPageToken: "second-page",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          models: [
            {
              name: "models/gemini-21-flash",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
        }),
      )

    const models = await fetchGoogleModels({
      baseURL: "https://generativelanguage.googleapis.com/v1beta/",
      apiKey: "secret-key",
    })

    expect(models).toEqual(["gemini-21-flash", "gemini-20-flash"])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      new URL("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"),
      expect.objectContaining({
        method: "GET",
        headers: { "x-goog-api-key": "secret-key" },
      }),
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      new URL(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&pageToken=second-page",
      ),
      expect.objectContaining({
        method: "GET",
        headers: { "x-goog-api-key": "secret-key" },
      }),
    )
  })

  it("surfaces an HTTP error from the Google API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          error: { message: "API key is invalid" },
        },
        {
          status: 403,
          statusText: "Forbidden",
        },
      ),
    )

    await expect(
      fetchGoogleModels({
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
        apiKey: "invalid-key",
      }),
    ).rejects.toThrow("Failed to fetch Google models: API key is invalid")
  })
})
