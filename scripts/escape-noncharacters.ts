// Chrome refuses to load a content script file that holds a Unicode
// noncharacter (U+FDD0–U+FDEF, or a code point ending in FFFE or FFFF),
// reporting it "isn't UTF-8 encoded". The minifier writes the U+FFFF escape
// in Temml's lexer as the character itself. These helpers write such
// characters back as escapes, which mean the same in every string, template
// and regular expression; a noncharacter cannot be part of an identifier.
// Other characters are left as they are: escaping all non-ASCII text would
// grow the content scripts by up to a third.

// A string, not a regex literal, so that no formatter writes the escapes as
// the characters themselves.
const CANDIDATES = new RegExp("[\\uFDD0-\\uFDEF\\uFFFE\\uFFFF]|[\\u{1FFFE}-\\u{10FFFF}]", "gu")

function isNoncharacter(codePoint: number) {
  return (codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xfffe) === 0xfffe
}

export function escapeNoncharacters(code: string): string {
  return code.replace(CANDIDATES, (char) => {
    const codePoint = char.codePointAt(0)!
    if (!isNoncharacter(codePoint)) return char
    const hex = codePoint.toString(16)
    return codePoint > 0xffff ? `\\u{${hex}}` : `\\u${hex.padStart(4, "0")}`
  })
}

interface OutputChunk {
  type: "chunk" | "asset"
  code?: string
}

/** A build plugin that escapes noncharacters in the finished (minified) chunks. */
export function escapeNoncharactersPlugin() {
  return {
    name: "read-frog:escape-noncharacters",
    generateBundle(_options: unknown, bundle: Record<string, OutputChunk>) {
      for (const output of Object.values(bundle)) {
        if (output.type === "chunk" && output.code) output.code = escapeNoncharacters(output.code)
      }
    },
  }
}
