// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { isSiteRuleForceBlockElement } from "../filter"

function setHost(host: string) {
  // jsdom exposes location as read-only; override via defineProperty
  Object.defineProperty(window, "location", {
    value: new URL(`https://${host}/some/path`),
    writable: true,
  })
}

describe("isSiteRuleForceBlockElement", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("matches task-lists element on github.com", () => {
    setHost("github.com")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(isSiteRuleForceBlockElement(taskLists, DEFAULT_CONFIG)).toBe(true)
  })

  it("does not match on non-configured host", () => {
    setHost("non-configured-example.org")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(isSiteRuleForceBlockElement(taskLists, DEFAULT_CONFIG)).toBe(false)
  })

  it("matches shreddit-post-text-body element on www.reddit.com", () => {
    setHost("www.reddit.com")

    const postTextBody = document.createElement("shreddit-post-text-body")
    document.body.appendChild(postTextBody)

    expect(isSiteRuleForceBlockElement(postTextBody, DEFAULT_CONFIG)).toBe(true)
  })

  it("does not match element outside configured parent on configured host", () => {
    setHost("github.com")

    const other = document.createElement("div")
    document.body.appendChild(other)

    expect(isSiteRuleForceBlockElement(other, DEFAULT_CONFIG)).toBe(false)
  })

  it("still matches when the URL includes a port", () => {
    setHost("github.com:3000")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(window.location.host).toContain(":")
    expect(window.location.hostname).toBe("github.com")

    expect(isSiteRuleForceBlockElement(taskLists, DEFAULT_CONFIG)).toBe(true)
  })

  it("does not match on non-configured host when host !== hostname", () => {
    setHost("non-configured-example.org:8080")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(window.location.host).toContain(":")
    expect(window.location.hostname).toBe("non-configured-example.org")

    expect(isSiteRuleForceBlockElement(taskLists, DEFAULT_CONFIG)).toBe(false)
  })
})
