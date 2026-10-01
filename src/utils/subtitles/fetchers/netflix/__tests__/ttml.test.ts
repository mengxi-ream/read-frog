// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { parseNetflixTtml } from "../ttml"

function buildTtml({ lang = "en", body }: { lang?: string; body: string }): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<tt ttp:contentProfiles="http://www.w3.org/ns/ttml/profile/imsc1.1/text" xmlns="http://www.w3.org/ns/ttml" xmlns:nttm="http://www.netflix.com/ns/ttml#metadata" xmlns:tt="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:xml="http://www.w3.org/XML/1998/namespace" ttp:tickRate="10000000" ttp:timeBase="media" xml:lang="${lang}">
<head>
<metadata nttm:schemaVersion="0" nttm:textType="SUBS" nttm:uuid="00000000-0000-0000-0000-000000000000"/>
<styling>
<style xml:id="style1" tts:fontWeight="normal"/>
<style xml:id="style2" tts:fontStyle="italic" tts:fontWeight="normal"/>
</styling>
<layout>
<region xml:id="region0" tts:displayAlign="after" tts:extent="80.000% 40.000%" tts:origin="10.000% 50.000%"/>
<region xml:id="region1" tts:displayAlign="before" tts:extent="80.000% 40.000%" tts:origin="10.000% 10.000%"/>
</layout>
</head>
<body><div>${body}</div></body>
</tt>`
}

describe("parseNetflixTtml", () => {
  it("reads the language and tick-based timing", () => {
    const parsed = parseNetflixTtml(
      buildTtml({
        body: `<p xml:id="subtitle2" begin="1238400000t" end="1254000000t" region="region0"><span style="style2">After that day,</span></p>`,
      }),
    )

    expect(parsed.language).toBe("en")
    expect(parsed.fragments).toEqual([{ text: "After that day,", start: 123840, end: 125400 }])
  })

  it("joins a wrapped sentence into one line", () => {
    const parsed = parseNetflixTtml(
      buildTtml({
        body: `<p begin="1259200000t" end="1285600000t" region="region0"><span style="style2">it feels like Luan Nian</span><br/><span style="style2">has put a spell on me.</span></p>`,
      }),
    )

    expect(parsed.fragments[0]?.text).toBe("it feels like Luan Nian has put a spell on me.")
  })

  it("keeps each speaker of a dialogue on its own line", () => {
    const parsed = parseNetflixTtml(
      buildTtml({
        body: `<p begin="10000000t" end="20000000t" region="region0"><span style="style1">-Maybe I can share them with you?</span><br/><span style="style1">-No need.</span></p>`,
      }),
    )

    expect(parsed.fragments[0]?.text).toBe("-Maybe I can share them with you?\n-No need.")
  })

  it("joins wrapped Chinese lines without inserting a space", () => {
    const parsed = parseNetflixTtml(
      buildTtml({
        lang: "zh-Hant",
        body: `<p begin="10000000t" end="20000000t" region="region0"><span style="style1">以後面試的話</span><br/><span style="style1">可不可以注意一下你的說話方式？</span></p>`,
      }),
    )

    expect(parsed.fragments[0]?.text).toBe("以後面試的話可不可以注意一下你的說話方式？")
  })

  it("stacks cues that share a time range from the top of the screen down", () => {
    const parsed = parseNetflixTtml(
      buildTtml({
        body: [
          `<p begin="30000000t" end="40000000t" region="region0"><span style="style1">Who's there?</span></p>`,
          `<p begin="30000000t" end="40000000t" region="region1"><span style="style1">OFFER LETTER</span></p>`,
          `<p begin="10000000t" end="20000000t" region="region1"><span style="style1">MUTE, HANG UP, CAMERA</span></p>`,
        ].join(""),
      }),
    )

    expect(parsed.fragments).toEqual([
      { text: "MUTE, HANG UP, CAMERA", start: 1000, end: 2000 },
      { text: "OFFER LETTER\nWho's there?", start: 3000, end: 4000 },
    ])
  })

  it("decodes entities and drops empty or zero-length cues", () => {
    const parsed = parseNetflixTtml(
      buildTtml({
        body: [
          `<p begin="10000000t" end="20000000t" region="region0"><span style="style1">Tom &amp; Jerry</span></p>`,
          `<p begin="20000000t" end="20000000t" region="region0"><span style="style1">instant</span></p>`,
          `<p begin="30000000t" end="40000000t" region="region0"><span style="style1"> </span></p>`,
        ].join(""),
      }),
    )

    expect(parsed.fragments).toEqual([{ text: "Tom & Jerry", start: 1000, end: 2000 }])
  })

  it("returns nothing for a document that is not TTML", () => {
    expect(parseNetflixTtml("<html><body>nope</body></html>")).toEqual({
      language: "",
      fragments: [],
    })
  })
})
