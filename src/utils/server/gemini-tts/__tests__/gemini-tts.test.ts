import type { GoogleProviderConfig } from "@/types/gemini-tts"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { buildGeminiTTSPrompt, listGeminiTTSVoices, synthesizeGeminiTTS, toUseCase } from "../index"

const PROVIDER_CONFIG = {
  ...DEFAULT_PROVIDER_CONFIG.google,
  apiKey: "test-key",
} as GoogleProviderConfig

const REQUEST = {
  text: "Hello",
  providerConfig: PROVIDER_CONFIG,
  model: "gemini-3.8-flash-lite-tts",
  voice: "Kore",
  style: "",
}

const WAV_BASE64 = btoa("RIFF\0\0\0\0WAVEfmt ")

function audioResponse(mimeType: string, data = WAV_BASE64) {
  return { candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }] }
}

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(body), { status, headers }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function requestOf(fetchMock: ReturnType<typeof mockFetch>, call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as [string | URL, RequestInit]
  return {
    url: String(url),
    headers: new Headers(init.headers),
    body: init.body ? JSON.parse(init.body as string) : undefined,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("buildGeminiTTSPrompt", () => {
  it("sends the text alone without a style", () => {
    expect(buildGeminiTTSPrompt("Hello", "  ")).toBe("Hello")
  })

  it("sets a style apart from the transcript", () => {
    expect(buildGeminiTTSPrompt("Hello", " calm and warm ")).toBe(
      "### DIRECTOR'S NOTES\nStyle: calm and warm\n\n### TRANSCRIPT\nHello",
    )
  })
})

describe("synthesizeGeminiTTS", () => {
  it("refuses without an API key and never calls the network", async () => {
    const fetchMock = mockFetch(200, {})
    const result = await synthesizeGeminiTTS({
      ...REQUEST,
      providerConfig: { ...PROVIDER_CONFIG, apiKey: "  " },
    })
    expect(result).toMatchObject({ ok: false, error: { code: "MISSING_API_KEY" } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sends the voice with the provider's key and headers, and returns the audio", async () => {
    const fetchMock = mockFetch(200, audioResponse("audio/wav"))
    const result = await synthesizeGeminiTTS({
      ...REQUEST,
      providerConfig: { ...PROVIDER_CONFIG, headers: { "cf-aig-authorization": "Bearer gw" } },
    })

    expect(result).toEqual({ ok: true, audioBase64: WAV_BASE64, contentType: "audio/wav" })
    const request = requestOf(fetchMock)
    expect(request.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-lite-tts:generateContent",
    )
    expect(request.headers.get("x-goog-api-key")).toBe("test-key")
    expect(request.headers.get("cf-aig-authorization")).toBe("Bearer gw")
    expect(request.body.generationConfig.speechConfig).toEqual({
      voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
    })
  })

  it("uses the provider's base URL", async () => {
    const fetchMock = mockFetch(200, audioResponse("audio/wav"))
    await synthesizeGeminiTTS({
      ...REQUEST,
      providerConfig: { ...PROVIDER_CONFIG, baseURL: "https://proxy.example.com/v1beta/" },
    })

    expect(requestOf(fetchMock).url).toBe(
      "https://proxy.example.com/v1beta/models/gemini-3.8-flash-lite-tts:generateContent",
    )
  })

  it("gives Gemini 3.8 the style as speech metadata, never as words to read", async () => {
    const fetchMock = mockFetch(200, audioResponse("audio/wav"))
    await synthesizeGeminiTTS({ ...REQUEST, style: " calm and warm " })

    expect(requestOf(fetchMock).body.contents[0].parts).toEqual([
      { text: "Hello", speechMetadata: { style: "calm and warm" } },
    ])
  })

  it("puts the style in the prompt for models that read directions from it", async () => {
    const fetchMock = mockFetch(200, audioResponse("audio/wav"))
    await synthesizeGeminiTTS({
      ...REQUEST,
      model: "gemini-2.5-flash-preview-tts",
      style: "calm and warm",
    })

    expect(requestOf(fetchMock).body.contents[0].parts).toEqual([
      { text: buildGeminiTTSPrompt("Hello", "calm and warm") },
    ])
  })

  it("wraps raw PCM in a WAV header at the reported sample rate", async () => {
    const pcm = btoa(String.fromCharCode(1, 2, 3, 4))
    mockFetch(200, audioResponse("audio/L16;codec=pcm;rate=16000", pcm))
    const result = await synthesizeGeminiTTS({ ...REQUEST, model: "gemini-2.5-flash-preview-tts" })

    if (!result.ok) throw new Error(result.error.message)
    const bytes = Uint8Array.from(atob(result.audioBase64), (char) => char.charCodeAt(0))
    expect(result.contentType).toBe("audio/wav")
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF")
    expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(16000)
    expect([...bytes.slice(44)]).toEqual([1, 2, 3, 4])
  })

  it("retries a rate limit, then reports it as RATE_LIMITED", async () => {
    const fetchMock = mockFetch(
      429,
      { error: { code: 429, message: "quota", status: "RESOURCE_EXHAUSTED" } },
      { "retry-after-ms": "0" },
    )
    expect(await synthesizeGeminiTTS(REQUEST)).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED", message: "quota", status: 429 },
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("reports a rejected key without retrying", async () => {
    const fetchMock = mockFetch(403, {
      error: { code: 403, message: "API key not valid", status: "PERMISSION_DENIED" },
    })
    expect(await synthesizeGeminiTTS(REQUEST)).toMatchObject({
      ok: false,
      error: { code: "REQUEST_REJECTED", message: "API key not valid", status: 403 },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("names the status when a gateway's error body is not Google's", async () => {
    mockFetch(401, { message: "unauthorized" })
    expect(await synthesizeGeminiTTS(REQUEST)).toMatchObject({
      ok: false,
      error: { code: "REQUEST_REJECTED", message: "Gemini TTS request failed (401)", status: 401 },
    })
  })

  it("reports a response with no audio", async () => {
    mockFetch(200, { candidates: [{ content: { parts: [] } }] })
    expect(await synthesizeGeminiTTS(REQUEST)).toMatchObject({
      ok: false,
      error: { code: "EMPTY_AUDIO" },
    })
  })

  it("reports an unreachable API as a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => {
        throw new TypeError("Failed to fetch")
      }),
    )
    expect(await synthesizeGeminiTTS(REQUEST)).toMatchObject({
      ok: false,
      error: { code: "NETWORK_ERROR" },
    })
  })
})

describe("toUseCase", () => {
  it.each([
    ["Storyteller & Narrator (Nature Documentary Narrator)", "Storyteller & Narrator"],
    ["Customer Support Agent / Call Center Agent (Social Worker)", "Customer Support Agent"],
    ["Concierge & EA", "Concierge & EA"],
    [undefined, "Other"],
  ])("takes the broad persona of %s", (persona, useCase) => {
    expect(toUseCase(persona)).toBe(useCase)
  })
})

describe("listGeminiTTSVoices", () => {
  it("follows every page, skips custom voices and normalizes each voice", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            voices: [
              { id: "voice_abc123", display_name: "My clone" },
              {
                id: "en-us-bodi",
                display_name: "Bodi",
                language_code: "en-US",
                accent: "West Coast",
                persona: "Educational Tutor (Chess Instructor)",
                gender: "male",
                pitch: "low",
                description: "Quiet and intimate.",
              },
            ],
            next_page_token: "page-2",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ voices: [{ id: "kore", gender: "other", pitch: "?" }] })),
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await listGeminiTTSVoices({
      providerConfig: { ...PROVIDER_CONFIG, headers: { "cf-aig-authorization": "Bearer gw" } },
    })

    expect(result).toEqual({
      ok: true,
      voices: [
        {
          voice: "en-us-bodi",
          name: "Bodi",
          languageCode: "en-US",
          accent: "West Coast",
          useCase: "Educational Tutor",
          description: "Quiet and intimate.",
          gender: "male",
          pitch: "low",
        },
        {
          voice: "kore",
          name: "kore",
          languageCode: "",
          accent: "",
          useCase: "Other",
          description: "",
          gender: "neutral",
          pitch: "medium",
        },
      ],
    })
    const [secondPageURL, init] = fetchMock.mock.calls[1] as [URL, RequestInit]
    expect(secondPageURL.searchParams.get("pageToken")).toBe("page-2")
    expect(new Headers(init.headers).get("cf-aig-authorization")).toBe("Bearer gw")
  })

  it("reports a rejected key", async () => {
    mockFetch(403, { error: { message: "API key not valid" } })
    expect(await listGeminiTTSVoices({ providerConfig: PROVIDER_CONFIG })).toMatchObject({
      ok: false,
      error: { code: "REQUEST_REJECTED", message: "API key not valid" },
    })
  })

  it("reports a server outage as a server error", async () => {
    mockFetch(503, { error: { message: "overloaded" } })
    expect(await listGeminiTTSVoices({ providerConfig: PROVIDER_CONFIG })).toMatchObject({
      ok: false,
      error: { code: "SERVER_ERROR", status: 503 },
    })
  })

  it("reports a base URL it cannot use instead of throwing", async () => {
    const fetchMock = mockFetch(200, { voices: [] })
    const result = await listGeminiTTSVoices({
      providerConfig: { ...PROVIDER_CONFIG, baseURL: "generativelanguage.googleapis.com/v1beta" },
    })

    expect(result).toMatchObject({ ok: false, error: { code: "NETWORK_ERROR" } })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
