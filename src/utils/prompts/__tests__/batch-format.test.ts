import { describe, expect, it } from "vitest"
import {
  DEFAULT_BATCH_TRANSLATE_PROMPT,
  NUMBERED_BATCH_TRANSLATE_PROMPT,
} from "@/utils/constants/prompt"
import {
  NUMBERED_BATCH_FORMAT,
  parseNumberedBatchResult,
  SEPARATED_BATCH_FORMAT,
} from "../batch-format"
import { SUBTITLE_BATCH_FORMAT } from "../subtitles"
import { PAGE_BATCH_FORMAT } from "../translate"

describe("batch formats", () => {
  it("keeps page translation on %% and numbers subtitle cues", () => {
    expect(PAGE_BATCH_FORMAT).toBe(SEPARATED_BATCH_FORMAT)
    expect(PAGE_BATCH_FORMAT.prompt).toBe(DEFAULT_BATCH_TRANSLATE_PROMPT)
    expect(SUBTITLE_BATCH_FORMAT).toBe(NUMBERED_BATCH_FORMAT)
    expect(SUBTITLE_BATCH_FORMAT.prompt).toBe(NUMBERED_BATCH_TRANSLATE_PROMPT)
  })

  it.each([
    ["separated", SEPARATED_BATCH_FORMAT],
    ["numbered", NUMBERED_BATCH_FORMAT],
  ])("reads back what the %s format writes", (_name, format) => {
    const texts = ["so today I want to show you", "- You okay?\n- Yeah.", "and why"]
    expect(format.parse(format.join(texts))).toEqual(texts)
  })

  it("writes each number on a line of its own, followed by its text", () => {
    expect(NUMBERED_BATCH_FORMAT.join(["so today", "- You okay?\n- Yeah."])).toBe(
      "[1]\nso today\n[2]\n- You okay?\n- Yeah.",
    )
  })
})

describe("parseNumberedBatchResult", () => {
  it("splits a reply whose numbers sit on lines of their own", () => {
    expect(
      parseNumberedBatchResult("[1]\n所以今天\n[2]\n- 你还好吗？\n- 嗯。\n[3]\n调音台"),
    ).toEqual(["所以今天", "- 你还好吗？\n- 嗯。", "调音台"])
  })

  it("also reads a reply with each text on its number's line", () => {
    expect(parseNumberedBatchResult("[1] 所以今天\n[2] 我想给你看\n[3] 调音台")).toEqual([
      "所以今天",
      "我想给你看",
      "调音台",
    ])
  })

  it("keeps a segment's own line breaks and blank lines between segments", () => {
    expect(parseNumberedBatchResult("[1] 第一行\n第二行\n\n[2] 下一句\r\n")).toEqual([
      "第一行\n第二行",
      "下一句",
    ])
  })

  it("leaves a bracketed number inside a line alone", () => {
    expect(parseNumberedBatchResult("[1] 见注释 [2]\n[2] 下一句")).toEqual(["见注释 [2]", "下一句"])
  })

  it("accepts markers indented or without a space after them", () => {
    expect(parseNumberedBatchResult("  [1]你好\n [2] 世界")).toEqual(["你好", "世界"])
  })

  it("keeps an empty segment, so the count still lines up", () => {
    expect(parseNumberedBatchResult("[1] 所以今天我想给你看\n[2]\n[3] 调音台")).toEqual([
      "所以今天我想给你看",
      "",
      "调音台",
    ])
  })

  it("refuses markers out of order", () => {
    expect(parseNumberedBatchResult("[1] 一\n[3] 三\n[2] 二")).toEqual([])
    expect(parseNumberedBatchResult("[2] 二\n[3] 三")).toEqual([])
  })

  it("refuses text before the first marker", () => {
    expect(parseNumberedBatchResult("Here is the translation:\n[1] 一\n[2] 二")).toEqual([])
  })

  it("reads a reply without any marker as one segment", () => {
    // A %% reply without a separator is one segment too; models often answer a
    // batch of one this way. BatchQueue refuses it for a larger batch.
    expect(parseNumberedBatchResult("安装")).toEqual(["安装"])
    expect(parseNumberedBatchResult("")).toEqual([""])
  })

  it("drops lines holding only %%, which a custom prompt asking for them adds", () => {
    expect(parseNumberedBatchResult("[1] 一\n%%\n[2] 二\n\n%%\n\n[3] 三")).toEqual([
      "一",
      "二",
      "三",
    ])
  })

  it("keeps %% inside a line", () => {
    expect(parseNumberedBatchResult("[1] 打印 100%% 的百分号\n[2] 二")).toEqual([
      "打印 100%% 的百分号",
      "二",
    ])
  })
})
