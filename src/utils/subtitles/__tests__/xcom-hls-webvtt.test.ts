import { describe, expect, it } from "vitest"
import {
  orderSubtitleRenditions,
  parseSubtitleRenditions,
  resolveSubtitleSegmentUrls,
} from "../fetchers/xcom/hls"
import { cleanWebVttCueText, parseWebVttSubtitles } from "../fetchers/xcom/webvtt"

describe("x.com HLS and WebVTT subtitles", () => {
  it("parses subtitle renditions from an HLS master manifest", () => {
    const renditions = parseSubtitleRenditions(
      "https://video.twimg.com/amplify_video/2042527457786679296/pl/AI0aJZC4F9qhX-TA.m3u8?tag=21&v=78e",
      [
        "#EXTM3U",
        "#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"English\",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE=\"en\",URI=\"/amplify_video/2042527457786679296/pl/s0/S15DavmEi29Ma0Vw.m3u8\"",
        "#EXT-X-STREAM-INF:BANDWIDTH=832000,SUBTITLES=\"subs\"",
        "/amplify_video/2042527457786679296/pl/avc1/320x180/abc.m3u8",
      ].join("\n"),
    )

    expect(renditions).toEqual([
      {
        autoselect: true,
        default: true,
        groupId: "subs",
        language: "en",
        name: "English",
        uri: "https://video.twimg.com/amplify_video/2042527457786679296/pl/s0/S15DavmEi29Ma0Vw.m3u8",
      },
    ])
  })

  it("resolves relative WebVTT segment URLs from subtitle playlists", () => {
    const urls = resolveSubtitleSegmentUrls(
      "https://video.twimg.com/amplify_video/2042527457786679296/pl/s0/S15DavmEi29Ma0Vw.m3u8",
      [
        "#EXTM3U",
        "#EXTINF:150.000,",
        "/subtitles/amplify_video/2042527457786679296/0/KGw6GlOWXiwUxoKA.vtt",
        "#EXTINF:3.000,",
        "relative-next.vtt?token=1",
      ].join("\n"),
    )

    expect(urls).toEqual([
      "https://video.twimg.com/subtitles/amplify_video/2042527457786679296/0/KGw6GlOWXiwUxoKA.vtt",
      "https://video.twimg.com/amplify_video/2042527457786679296/pl/s0/relative-next.vtt?token=1",
    ])
  })

  it("orders selected, default, autoselect, then original tracks", () => {
    const english = {
      autoselect: true,
      default: true,
      groupId: "subs",
      language: "en",
      name: "English",
      uri: "https://video.twimg.com/subs-en.m3u8",
    }
    const spanish = {
      autoselect: true,
      default: false,
      groupId: "subs",
      language: "es",
      name: "Spanish",
      uri: "https://video.twimg.com/subs-es.m3u8",
    }
    const japanese = {
      autoselect: false,
      default: false,
      groupId: "subs",
      language: "ja",
      name: "Japanese",
      uri: "https://video.twimg.com/subs-ja.m3u8",
    }

    expect(orderSubtitleRenditions([english, spanish, japanese], {
      label: "Spanish",
      language: "es",
      mode: "showing",
    })).toEqual([spanish, english, japanese])

    expect(orderSubtitleRenditions([japanese, spanish, english], null)).toEqual([english, spanish, japanese])
  })

  it("parses WebVTT cues into subtitle fragments", () => {
    const fragments = parseWebVttSubtitles([
      "WEBVTT",
      "",
      "00:00:00.123 --> 00:00:02.696 align:start",
      "Princess Treatment",
      "or Bare Minimum.",
      "",
      "cue-2",
      "00:02.700 --> 00:04.000",
      "<v Speaker>only on iQIYI &amp; iQ.com.</v>",
    ].join("\n"))

    expect(fragments).toEqual([
      {
        text: "Princess Treatment\nor Bare Minimum.",
        start: 123,
        end: 2696,
      },
      {
        text: "only on iQIYI & iQ.com.",
        start: 2700,
        end: 4000,
      },
    ])
  })

  it("removes X word timing tags from WebVTT cue text", () => {
    expect(cleanWebVttCueText("<X-word-ms ms=880,2399 index=15>У меня есть iPad с множеством вопросов</X-word-ms>")).toBe(
      "У меня есть iPad с множеством вопросов",
    )
    expect(cleanWebVttCueText("&lt;X-word-ms ms=179 index=16&gt;И мы поделимся тем&lt;/X-word-ms&gt;")).toBe(
      "И мы поделимся тем",
    )
  })
})
