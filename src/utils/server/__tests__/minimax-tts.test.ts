import type { MiniMaxTTSSynthesizeRequest } from "@/types/minimax-tts"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MINIMAX_TTS_ENDPOINTS } from "@/types/minimax-tts"
import { synthesizeMiniMaxTTS } from "../minimax-tts"

const baseRequest: MiniMaxTTSSynthesizeRequest = {
  apiKey: "test-api-key",
  text: "Hello",
  region: "global",
  model: "speech-2.8-hd",
  voiceId: "test-voice",
  audioFormat: "mp3",
}

function successResponse(audio = "494433") {
  return new Response(
    JSON.stringify({
      data: { audio, status: 2 },
      base_resp: { status_code: 0, status_msg: "success" },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("synthesizeMiniMaxTTS", () => {
  it("maps the global request and decodes hex audio", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(successResponse())
    vi.stubGlobal("fetch", fetchMock)

    const result = await synthesizeMiniMaxTTS(baseRequest)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(MINIMAX_TTS_ENDPOINTS.global)
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer test-api-key",
        "Content-Type": "application/json",
      },
    })
    if (typeof init?.body !== "string") {
      throw new TypeError("Expected a JSON request body")
    }
    expect(JSON.parse(init.body)).toEqual({
      model: "speech-2.8-hd",
      text: "Hello",
      stream: false,
      language_boost: "auto",
      output_format: "hex",
      voice_setting: { voice_id: "test-voice" },
      audio_setting: { format: "mp3" },
    })
    if (!result.ok) {
      throw new Error(result.error.message)
    }
    expect([...new Uint8Array(result.audio)]).toEqual([0x49, 0x44, 0x33])
    expect(result.contentType).toBe("audio/mpeg")
  })

  it("uses the China endpoint and preserves the selected audio format", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(successResponse("52494646"))
    vi.stubGlobal("fetch", fetchMock)

    const result = await synthesizeMiniMaxTTS({
      ...baseRequest,
      region: "china",
      model: "speech-2.8-turbo",
      audioFormat: "wav",
    })

    expect(fetchMock).toHaveBeenCalledWith(MINIMAX_TTS_ENDPOINTS.china, expect.any(Object))
    expect(result).toMatchObject({ ok: true, contentType: "audio/wav" })
  })

  it("rejects provider errors and incomplete audio responses", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            base_resp: { status_code: 1004, status_msg: "invalid request" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { status: 1 },
            base_resp: { status_code: 0, status_msg: "success" },
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(synthesizeMiniMaxTTS(baseRequest)).resolves.toMatchObject({
      ok: false,
      error: { code: "REQUEST_FAILED" },
    })
    await expect(synthesizeMiniMaxTTS(baseRequest)).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_RESPONSE" },
    })
  })
})
