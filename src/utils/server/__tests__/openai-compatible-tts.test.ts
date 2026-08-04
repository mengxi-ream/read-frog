import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildOpenAICompatibleTTSEndpoint,
  synthesizeOpenAICompatibleTTS,
} from "../openai-compatible-tts"

const config = {
  baseURL: "http://127.0.0.1:8880/v1",
  apiKey: "secret-token",
  model: "kokoro",
  voice: "af_heart",
  responseFormat: "mp3" as const,
  speed: 1,
  instructions: "Speak warmly",
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("buildOpenAICompatibleTTSEndpoint", () => {
  it("appends the OpenAI speech path to a base URL", () => {
    expect(buildOpenAICompatibleTTSEndpoint("http://127.0.0.1:8880/v1/").toString()).toBe(
      "http://127.0.0.1:8880/v1/audio/speech",
    )
  })

  it("accepts a complete speech endpoint without duplicating the path", () => {
    expect(
      buildOpenAICompatibleTTSEndpoint(
        "https://speech.example.com/custom/v1/audio/speech",
      ).toString(),
    ).toBe("https://speech.example.com/custom/v1/audio/speech")
  })

  it("preserves query parameters on a complete speech endpoint", () => {
    expect(
      buildOpenAICompatibleTTSEndpoint(
        "https://speech.example.com/v1/audio/speech?api-version=2026-01-01&route=signed",
      ).toString(),
    ).toBe("https://speech.example.com/v1/audio/speech?api-version=2026-01-01&route=signed")
  })

  it("rejects unsupported protocols and embedded credentials", () => {
    expect(() => buildOpenAICompatibleTTSEndpoint("file:///tmp/speech")).toThrow(
      "must use http or https",
    )
    expect(() => buildOpenAICompatibleTTSEndpoint("https://user:pass@example.com/v1")).toThrow(
      "must not contain credentials",
    )
  })
})

describe("synthesizeOpenAICompatibleTTS", () => {
  it("sends an OpenAI-compatible request and returns audio", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await synthesizeOpenAICompatibleTTS("Hello", config)

    expect(result.audio.byteLength).toBe(3)
    expect(result.contentType).toBe("audio/mpeg")
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBeInstanceOf(URL)
    expect((url as URL).href).toBe("http://127.0.0.1:8880/v1/audio/speech")
    if (!init || typeof init.body !== "string") {
      throw new Error("Expected a JSON request body")
    }
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer secret-token",
    })
    expect(JSON.parse(init.body)).toEqual({
      model: "kokoro",
      input: "Hello",
      voice: "af_heart",
      response_format: "mp3",
      speed: 1,
      instructions: "Speak warmly",
    })
  })

  it("omits optional authorization and instructions", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1]), {
        status: 200,
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await synthesizeOpenAICompatibleTTS("Hello", {
      ...config,
      apiKey: "",
      instructions: " ",
      responseFormat: "wav",
    })

    const [, init] = fetchMock.mock.calls[0]!
    if (!init || typeof init.body !== "string") {
      throw new Error("Expected a JSON request body")
    }
    expect(init.headers).not.toHaveProperty("Authorization")
    expect(JSON.parse(init.body)).not.toHaveProperty("instructions")
  })

  it("includes the HTTP status and response body when the API rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("unknown voice", {
          status: 400,
          statusText: "Bad Request",
        }),
      ),
    )

    await expect(synthesizeOpenAICompatibleTTS("Hello", config)).rejects.toMatchObject({
      status: 400,
      message: "TTS API returned 400 Bad Request: unknown voice",
    })
  })
})
