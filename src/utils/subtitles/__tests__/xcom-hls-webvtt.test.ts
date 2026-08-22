import { describe, expect, it } from "vitest"
import {
  orderSubtitleRenditions,
  parseHlsAttributeList,
  parseSubtitleRenditions,
  resolveSubtitleSegmentUrls,
} from "../fetchers/xcom/hls"
import {
  cleanWebVttCueText,
  getWebVttTimestampMapOffsetMs,
  parseWebVttSubtitles,
} from "../fetchers/xcom/webvtt"

const MANIFEST_URL = "https://video.twimg.com/amplify_video/1234/pl/master.m3u8"

describe("parseHlsAttributeList", () => {
  it("parses quoted and unquoted attributes", () => {
    const attributes = parseHlsAttributeList(
      '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=YES,URI="/pl/s1/en.m3u8"',
    )

    expect(attributes.TYPE).toBe("SUBTITLES")
    expect(attributes["GROUP-ID"]).toBe("subs")
    expect(attributes.NAME).toBe("English")
    expect(attributes.DEFAULT).toBe("YES")
    expect(attributes.URI).toBe("/pl/s1/en.m3u8")
  })
})

describe("parseSubtitleRenditions", () => {
  it("keeps only SUBTITLES renditions and resolves relative URIs", () => {
    const manifest = [
      "#EXTM3U",
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Audio",URI="/pl/a1/audio.m3u8"',
      '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="/pl/s1/en.m3u8"',
      "#EXT-X-STREAM-INF:BANDWIDTH=1000000",
      "/pl/v1/video.m3u8",
    ].join("\n")

    const renditions = parseSubtitleRenditions(MANIFEST_URL, manifest)

    expect(renditions).toHaveLength(1)
    expect(renditions[0]).toMatchObject({
      groupId: "subs",
      name: "English",
      language: "en",
      default: true,
      autoselect: true,
      uri: "https://video.twimg.com/pl/s1/en.m3u8",
    })
  })

  it("ignores SUBTITLES renditions without a URI", () => {
    const manifest = '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en"'
    expect(parseSubtitleRenditions(MANIFEST_URL, manifest)).toHaveLength(0)
  })

  it("returns an empty list for a manifest with no subtitles", () => {
    expect(parseSubtitleRenditions(MANIFEST_URL, "#EXTM3U\n/pl/v1/video.m3u8")).toHaveLength(0)
  })
})

describe("resolveSubtitleSegmentUrls", () => {
  it("resolves segment lines and skips tags and blank lines", () => {
    const playlist = [
      "#EXTM3U",
      "#EXT-X-TARGETDURATION:6",
      "",
      "#EXTINF:6.0,",
      "seg1.vtt",
      "#EXTINF:6.0,",
      "seg2.vtt",
      "#EXT-X-ENDLIST",
    ].join("\r\n")

    expect(resolveSubtitleSegmentUrls("https://video.twimg.com/pl/s1/en.m3u8", playlist)).toEqual([
      "https://video.twimg.com/pl/s1/seg1.vtt",
      "https://video.twimg.com/pl/s1/seg2.vtt",
    ])
  })
})

describe("orderSubtitleRenditions", () => {
  const english = {
    autoselect: false,
    default: false,
    groupId: "subs",
    language: "en",
    name: "English",
    uri: "en.m3u8",
  }
  const japanese = {
    autoselect: true,
    default: false,
    groupId: "subs",
    language: "ja",
    name: "Japanese",
    uri: "ja.m3u8",
  }
  const spanish = {
    autoselect: false,
    default: true,
    groupId: "subs",
    language: "es",
    name: "Spanish",
    uri: "es.m3u8",
  }

  it("returns the list untouched when there is at most one rendition", () => {
    expect(orderSubtitleRenditions([english], null)).toEqual([english])
  })

  it("puts the rendition matching the selected track first", () => {
    const ordered = orderSubtitleRenditions([spanish, japanese, english], {
      label: "English",
      language: "en",
      mode: "showing",
    })

    expect(ordered[0]).toBe(english)
  })

  it("matches the selected track by label when the language is absent", () => {
    const ordered = orderSubtitleRenditions([spanish, japanese, english], {
      label: "Japanese",
      language: "",
      mode: "showing",
    })

    expect(ordered[0]).toBe(japanese)
  })

  it("falls back to the default then the autoselect rendition", () => {
    const ordered = orderSubtitleRenditions([english, japanese, spanish], null)

    expect(ordered[0]).toBe(spanish)
    expect(ordered[1]).toBe(japanese)
  })

  it("does not duplicate renditions", () => {
    const ordered = orderSubtitleRenditions([english, japanese, spanish], {
      label: "Spanish",
      language: "es",
      mode: "showing",
    })

    expect(ordered).toHaveLength(3)
    expect(new Set(ordered).size).toBe(3)
  })
})

describe("cleanWebVttCueText", () => {
  it("strips cue tags and decodes html entities", () => {
    expect(cleanWebVttCueText("<c.yellow>Tom &amp; Jerry</c>")).toBe("Tom & Jerry")
  })

  it("trims each line while preserving line breaks", () => {
    expect(cleanWebVttCueText("  first line  \n  second line  ")).toBe("first line\nsecond line")
  })
})

describe("getWebVttTimestampMapOffsetMs", () => {
  it("converts an MPEGTS presentation offset into milliseconds", () => {
    const vtt =
      "WEBVTT\nX-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:900000\n\n00:00.000 --> 00:01.000\nHi"

    expect(getWebVttTimestampMapOffsetMs(vtt)).toBe(10_000)
  })

  it("subtracts a non-zero LOCAL anchor", () => {
    const vtt =
      "WEBVTT\nX-TIMESTAMP-MAP=LOCAL:00:00:02.000,MPEGTS:900000\n\n00:02.000 --> 00:03.000\nHi"

    expect(getWebVttTimestampMapOffsetMs(vtt)).toBe(8000)
  })

  it("returns null when the header is absent", () => {
    expect(getWebVttTimestampMapOffsetMs("WEBVTT\n\n00:00.000 --> 00:01.000\nHi")).toBeNull()
  })

  it("returns null when the header is malformed", () => {
    expect(
      getWebVttTimestampMapOffsetMs("WEBVTT\nX-TIMESTAMP-MAP=LOCAL:bogus,MPEGTS:900000"),
    ).toBeNull()
  })
})

describe("parseWebVttSubtitles", () => {
  it("parses cues with hour-less and hour-prefixed timestamps", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00.000 --> 00:02.500",
      "Hello world",
      "",
      "01:00:01.000 --> 01:00:03.000",
      "Much later",
    ].join("\n")

    expect(parseWebVttSubtitles(vtt)).toEqual([
      { text: "Hello world", start: 0, end: 2500 },
      { text: "Much later", start: 3601000, end: 3603000 },
    ])
  })

  it("skips cue identifiers, NOTE, STYLE and REGION blocks", () => {
    const vtt = [
      "WEBVTT",
      "",
      "NOTE this is ignored",
      "",
      "STYLE",
      "::cue { color: red }",
      "",
      "cue-1",
      "00:00.000 --> 00:01.000",
      "Kept",
    ].join("\n")

    expect(parseWebVttSubtitles(vtt)).toEqual([{ text: "Kept", start: 0, end: 1000 }])
  })

  it("ignores cue settings after the end timestamp", () => {
    const vtt = "WEBVTT\n\n00:00.000 --> 00:01.000 align:start position:10%\nWith settings"

    expect(parseWebVttSubtitles(vtt)).toEqual([{ text: "With settings", start: 0, end: 1000 }])
  })

  it("drops cues with empty text or a non-positive duration", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00.000 --> 00:00.000",
      "Zero length",
      "",
      "00:02.000 --> 00:01.000",
      "Reversed",
      "",
      "00:03.000 --> 00:04.000",
      "Kept",
    ].join("\n")

    expect(parseWebVttSubtitles(vtt)).toEqual([{ text: "Kept", start: 3000, end: 4000 }])
  })

  it("handles a BOM and CRLF line endings and sorts by start time", () => {
    const vtt =
      "﻿WEBVTT\r\n\r\n00:05.000 --> 00:06.000\r\nSecond\r\n\r\n00:01.000 --> 00:02.000\r\nFirst"

    expect(parseWebVttSubtitles(vtt)).toEqual([
      { text: "First", start: 1000, end: 2000 },
      { text: "Second", start: 5000, end: 6000 },
    ])
  })

  it("returns an empty list for a header-only file", () => {
    expect(parseWebVttSubtitles("WEBVTT\n")).toEqual([])
  })
})
