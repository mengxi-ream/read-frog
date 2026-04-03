import { describe, expect, it } from "vitest"

import { getBotAuthorSkipReason, isBotAuthor } from "./bot-author.js"

describe("isBotAuthor", () => {
  it("treats GitHub Bot accounts as bots", () => {
    expect(isBotAuthor({
      login: "dependabot[bot]",
      type: "Bot",
    })).toBe(true)
  })

  it("falls back to the login suffix when the type is not marked as Bot", () => {
    expect(isBotAuthor({
      login: "renovate[bot]",
      type: "User",
    })).toBe(true)
  })

  it("does not flag human authors", () => {
    expect(isBotAuthor({
      login: "mengxi-ream",
      type: "User",
    })).toBe(false)
  })
})

describe("getBotAuthorSkipReason", () => {
  it("returns a skip reason for bot-authored pull requests", () => {
    expect(getBotAuthorSkipReason({
      login: "dependabot[bot]",
      type: "Bot",
    })).toBe("bot-authored PR by @dependabot[bot]")
  })

  it("returns null for human-authored pull requests", () => {
    expect(getBotAuthorSkipReason({
      login: "mengxi-ream",
      type: "User",
    })).toBeNull()
  })
})
