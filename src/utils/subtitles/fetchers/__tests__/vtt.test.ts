import { describe, expect, it } from "vitest"
import { parseWebVtt } from "../vtt"

describe("parseWebVtt", () => {
  it("reads cues after the header, across CRLF line breaks and multi-line text", () => {
    const vtt = [
      "WEBVTT",
      "Kind: captions",
      "Language: en",
      "",
      "00:00:01.980 --> 00:00:06.320",
      "In this lecture, we will see the syntax for",
      "defining classes and creating objects.",
      "",
      "00:00:06.560 --> 00:00:09.460",
      "A new class",
    ].join("\r\n")

    expect(parseWebVtt(vtt)).toEqual([
      {
        text: "In this lecture, we will see the syntax for\ndefining classes and creating objects.",
        start: 1980,
        end: 6320,
      },
      { text: "A new class", start: 6560, end: 9460 },
    ])
  })

  it("reads cue identifiers, short and long timestamps, and cue settings", () => {
    const vtt =
      "WEBVTT\n\n0\n00:03.610 --> 00:08.530 align:start\nHello\n\nintro\n01:02:03.004 --> 01:02:04.000\nBye"

    expect(parseWebVtt(vtt)).toEqual([
      { text: "Hello", start: 3610, end: 8530 },
      { text: "Bye", start: 3723004, end: 3724000 },
    ])
  })

  it("ends a cue at a line of only spaces", () => {
    const vtt = "WEBVTT\n\n00:01.000 --> 00:02.000\nFirst\n \n00:02.000 --> 00:03.000\nSecond"

    expect(parseWebVtt(vtt)).toEqual([
      { text: "First", start: 1000, end: 2000 },
      { text: "Second", start: 2000, end: 3000 },
    ])
  })

  it("skips blocks without cue timing", () => {
    const vtt =
      "WEBVTT\n\nNOTE written by hand\n\nSTYLE\n::cue { color: red }\n\n00:01.000 --> 00:02.000\nKept"

    expect(parseWebVtt(vtt)).toEqual([{ text: "Kept", start: 1000, end: 2000 }])
  })
})
