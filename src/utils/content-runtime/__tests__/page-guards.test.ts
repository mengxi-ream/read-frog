// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest"
import { isCloudflareChallenge, shouldSkipDocument } from "../page-guards"

function addScript(src: string) {
  const script = document.createElement("script")
  script.src = src
  document.head.append(script)
}

describe("page guards", () => {
  afterEach(() => {
    document.head.replaceChildren()
    document.body.replaceChildren()
  })

  it("runs on an ordinary page", () => {
    expect(shouldSkipDocument(document)).toBe(false)
  })

  it("skips a Cloudflare challenge page", () => {
    addScript("/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1?ray=8f00")
    expect(isCloudflareChallenge(document)).toBe(true)
    expect(shouldSkipDocument(document)).toBe(true)
  })

  it("skips the legacy challenge form", () => {
    const form = document.createElement("form")
    form.id = "challenge-form"
    form.action = "/article?__cf_chl_f_tk=abc"
    document.body.append(form)
    expect(isCloudflareChallenge(document)).toBe(true)
  })

  it("runs on a page whose own form is called challenge-form", () => {
    const form = document.createElement("form")
    form.id = "challenge-form"
    form.action = "/quiz/answer"
    document.body.append(form)
    expect(isCloudflareChallenge(document)).toBe(false)
  })

  it("runs on a page that only carries Cloudflare's bot detection script", () => {
    addScript("/cdn-cgi/challenge-platform/scripts/jsd/main.js")
    expect(isCloudflareChallenge(document)).toBe(false)
  })

  it("skips XML and SVG documents", () => {
    const xml = new DOMParser().parseFromString("<rss><channel /></rss>", "application/xml")
    const svg = document.implementation.createDocument("http://www.w3.org/2000/svg", "svg")
    expect(shouldSkipDocument(xml)).toBe(true)
    expect(shouldSkipDocument(svg)).toBe(true)
  })
})
