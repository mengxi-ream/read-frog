import { describe, expect, it } from "vitest"
import { getBilibiliPartIdFromUrl } from "../video-id/bilibili"

describe("getBilibiliPartIdFromUrl", () => {
  it("names the first part when the url has no `p`", () => {
    expect(getBilibiliPartIdFromUrl("https://www.bilibili.com/video/BV1XZn26rE8x/")).toBe(
      "BV1XZn26rE8x:1",
    )
    expect(getBilibiliPartIdFromUrl("https://www.bilibili.com/video/BV1XZn26rE8x?p=1")).toBe(
      "BV1XZn26rE8x:1",
    )
  })

  it("names the part `p` picks", () => {
    expect(
      getBilibiliPartIdFromUrl("https://www.bilibili.com/video/BV1XZn26rE8x/?p=3&vd_source=x"),
    ).toBe("BV1XZn26rE8x:3")
  })

  it("reads a video behind a locale prefix", () => {
    expect(getBilibiliPartIdFromUrl("https://www.bilibili.com/zh-Hans/video/BV1XZn26rE8x/")).toBe(
      "BV1XZn26rE8x:1",
    )
  })

  it("reads an av id", () => {
    expect(getBilibiliPartIdFromUrl("https://www.bilibili.com/video/av170001")).toBe("av170001:1")
  })

  it("reads the video a playlist page plays", () => {
    expect(
      getBilibiliPartIdFromUrl("https://www.bilibili.com/list/12345?bvid=BV1XZn26rE8x&p=2"),
    ).toBe("BV1XZn26rE8x:2")
  })

  it("ignores pages that are not a video", () => {
    expect(getBilibiliPartIdFromUrl("https://www.bilibili.com/")).toBeNull()
    expect(getBilibiliPartIdFromUrl("https://www.bilibili.com/bangumi/play/ep123")).toBeNull()
    expect(getBilibiliPartIdFromUrl("https://www.bilibili.com/video/not-an-id")).toBeNull()
    expect(getBilibiliPartIdFromUrl("https://www.bilibili.com/list/12345")).toBeNull()
    expect(getBilibiliPartIdFromUrl("not a url")).toBeNull()
  })
})
