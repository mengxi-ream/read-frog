import { describe, expect, it } from "vitest"
import { buildSSMLRequest } from "../ssml"

describe("buildSSMLRequest", () => {
  it("builds a single voice + prosody ssml body", () => {
    const ssml = buildSSMLRequest({
      text: "Hello world",
      voice: "en-US-JennyNeural",
      rate: "+10%",
      pitch: "+0Hz",
      volume: "+0%",
    })

    expect(ssml.includes("<voice name=\"en-US-JennyNeural\">")).toBe(true)
    expect(ssml.includes("<prosody rate=\"+10%\" pitch=\"+0Hz\" volume=\"+0%\">")).toBe(true)
  })

  it("escapes xml sensitive characters", () => {
    const ssml = buildSSMLRequest({
      text: `a < b & c > d "e" 'f'`,
      voice: "en-US-JennyNeural",
    })

    expect(ssml).toContain("&lt;")
    expect(ssml).toContain("&gt;")
    expect(ssml).toContain("&amp;")
    expect(ssml).toContain("&quot;")
    expect(ssml).toContain("&apos;")
  })

  it("escapes ssml attribute values", () => {
    const ssml = buildSSMLRequest({
      text: "hello",
      voice: "en\" /><malicious-US-JennyNeural",
      rate: "+10%\" /><break strength=\"x\"",
      pitch: "+0Hz",
      volume: "+0%",
    })

    expect(ssml).toContain("xml:lang=\"en&quot; /&gt;&lt;malicious-US\"")
    expect(ssml).toContain("name=\"en&quot; /&gt;&lt;malicious-US-JennyNeural\"")
    expect(ssml).toContain("rate=\"+10%&quot; /&gt;&lt;break strength=&quot;x&quot;\"")
    expect(ssml).not.toContain("<break strength=")
  })

  it("rejects empty text", () => {
    expect(() => buildSSMLRequest({
      text: "   ",
      voice: "en-US-JennyNeural",
    })).toThrowError(/input is empty/i)
  })
})
