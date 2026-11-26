import { runInNewContext } from "node:vm"
import { describe, expect, it } from "vitest"
import { escapeNoncharacters } from "../escape-noncharacters"

// Built from code points so that this file stays free of the characters.
const char = (...codePoints: number[]) => String.fromCodePoint(...codePoints)

describe("escapeNoncharacters", () => {
  it("writes noncharacters as escapes", () => {
    expect(escapeNoncharacters(`[豈-${char(0xffff)}]`)).toBe("[豈-\\uffff]")
    expect(escapeNoncharacters(char(0xfdd0, 0xfdef, 0xfffe))).toBe("\\ufdd0\\ufdef\\ufffe")
    expect(escapeNoncharacters(`a${char(0x1ffff)}b${char(0x10fffe)}`)).toBe(
      "a\\u{1ffff}b\\u{10fffe}",
    )
  })

  it("leaves every other character as it is", () => {
    const text = `翻译 · café · 😀 · ${char(0x1fffd, 0xfffd, 0xfdcf, 0xfdf0)}`
    expect(escapeNoncharacters(text)).toBe(text)
  })

  it("keeps what the code means", () => {
    const ffff = char(0xffff)
    const code = `[\`[${char(0xf900)}-${ffff}]\`, '${char(0xfffe)}', new RegExp(\`[${ffff}]\`).test('${ffff}'), /[${char(0x1ffff)}]/u.test('${char(0x1ffff)}')]`
    const escaped = escapeNoncharacters(code)

    expect(escaped.includes(ffff) || escaped.includes(char(0xfffe))).toBe(false)
    expect(runInNewContext(escaped)).toEqual(runInNewContext(code))
    expect(runInNewContext(escaped)).toEqual([
      `[${char(0xf900)}-${ffff}]`,
      char(0xfffe),
      true,
      true,
    ])
  })
})
