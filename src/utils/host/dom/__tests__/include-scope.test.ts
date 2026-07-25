// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import type { SiteRule } from "@/types/config/site-rules"
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { PARAGRAPH_ATTRIBUTE, WALKED_ATTRIBUTE } from "@/utils/constants/dom-labels"
import { walkAndLabelElement } from "../traversal"

function setHost(host: string) {
  setUrl(`https://${host}/some/path`)
}

function setUrl(url: string) {
  Object.defineProperty(window, "location", {
    value: new URL(url),
    writable: true,
  })
}

function configWithUserRule(rule: Partial<SiteRule>): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.siteRules = {
    userRules: [{ id: "test-rule", matches: "include-example.org", ...rule }],
    disabledBuiltInRules: [],
  }
  return config
}

describe("includeSelectors whitelist", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("only labels paragraphs inside the whitelisted subtree", () => {
    setHost("include-example.org")
    document.body.innerHTML = `
      <article><p id="inside">Inside the whitelist</p></article>
      <div class="sidebar"><p id="outside">Outside the whitelist</p></div>
    `

    walkAndLabelElement(document.body, "w1", configWithUserRule({ includeSelectors: ["article"] }))

    expect(document.querySelector("#inside")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    expect(document.querySelector("#outside")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
  })

  it("labels everything when the rule has no includeSelectors", () => {
    setHost("include-example.org")
    document.body.innerHTML = `
      <article><p id="inside">Inside</p></article>
      <div class="sidebar"><p id="outside">Outside</p></div>
    `

    walkAndLabelElement(
      document.body,
      "w1",
      configWithUserRule({ excludeSelectors: [".unrelated"] }),
    )

    expect(document.querySelector("#inside")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    expect(document.querySelector("#outside")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
  })

  it("labels Steam app descriptions without the obsolete iframe include (issue #1923)", () => {
    setUrl("https://store.steampowered.com/app/2453660/Hoop_Land/")
    document.body.innerHTML = `
      <div class="game_description_snippet">
        <p id="description">Build a basketball legacy across seasons and leagues.</p>
      </div>
    `

    walkAndLabelElement(document.body, "w1", structuredClone(DEFAULT_CONFIG))

    expect(document.querySelector("#description")!.hasAttribute(WALKED_ATTRIBUTE)).toBe(true)
    expect(document.querySelector("#description")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
  })

  it("lets excludeSelectors carve holes inside the whitelisted subtree", () => {
    setHost("include-example.org")
    document.body.innerHTML = `
      <article>
        <p id="kept">Translate me</p>
        <div class="code-sample"><p id="carved">Do not translate</p></div>
      </article>
    `

    walkAndLabelElement(
      document.body,
      "w1",
      configWithUserRule({
        includeSelectors: ["article"],
        excludeSelectors: [".code-sample"],
      }),
    )

    expect(document.querySelector("#kept")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    expect(document.querySelector("#carved")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
  })

  it("does not apply the whitelist on other sites", () => {
    setHost("other-site.org")
    document.body.innerHTML = `<div class="sidebar"><p id="outside">Text</p></div>`

    walkAndLabelElement(document.body, "w1", configWithUserRule({ includeSelectors: ["article"] }))

    expect(document.querySelector("#outside")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
  })

  it("does not descend into an excluded subtree for nested include targets", () => {
    setHost("include-example.org")
    document.body.innerHTML = `
      <div class="sidebar">
        <p id="noise">Ad text that stays untranslated</p>
        <div class="recommended"><p id="nested-include">Recommended article title</p></div>
      </div>
    `

    walkAndLabelElement(
      document.body,
      "w1",
      configWithUserRule({
        excludeSelectors: [".sidebar"],
        includeSelectors: [".sidebar .recommended"],
      }),
    )

    expect(document.querySelector("#nested-include")!.hasAttribute(WALKED_ATTRIBUTE)).toBe(false)
    expect(document.querySelector("#nested-include")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
    expect(document.querySelector("#noise")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
  })

  it("still blocks excluded subtrees without include targets", () => {
    setHost("include-example.org")
    document.body.innerHTML = `
      <div class="sidebar"><p id="blocked">Sidebar text</p></div>
      <div class="recommended"><p id="kept">Recommended outside sidebar</p></div>
    `

    walkAndLabelElement(
      document.body,
      "w1",
      configWithUserRule({
        excludeSelectors: [".sidebar"],
        includeSelectors: [".recommended"],
      }),
    )

    expect(document.querySelector("#blocked")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
    expect(document.querySelector("#kept")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
  })

  it("re-includes an excluded element that also matches an include selector", () => {
    setHost("include-example.org")
    document.body.innerHTML = `
      <a data-kind="issue" id="reincluded">Bug: something is broken</a>
      <a data-kind="user" id="stays-excluded">octocat</a>
    `

    walkAndLabelElement(
      document.body,
      "w1",
      configWithUserRule({
        excludeSelectors: ["a[data-kind]"],
        includeSelectors: ["a[data-kind='issue']"],
      }),
    )

    expect(document.querySelector("#reincluded")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    expect(document.querySelector("#stays-excluded")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
  })

  // Regression: github issue-list titles are <a data-hovercard-type="issue"
  // data-testid="issue-pr-title-link">, which the built-in github rule both
  // excludes (a[data-hovercard-type]) and whitelists — the whitelist must win.
  it("labels github issue titles through the built-in rule", () => {
    setHost("github.com")
    document.body.innerHTML = `
      <ul>
        <li>
          <h3><a data-hovercard-type="issue" data-testid="issue-pr-title-link" href="/facebook/react/issues/1" id="issue-title">Bug: useEffect fires twice in strict mode</a></h3>
        </li>
        <li>
          <a data-hovercard-type="user" href="/gaearon" id="user-link">gaearon</a>
        </li>
      </ul>
    `

    walkAndLabelElement(document.body, "w1", structuredClone(DEFAULT_CONFIG))

    expect(document.querySelector("#issue-title")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    expect(document.querySelector("#user-link")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
  })

  it("keeps X usernames excluded when a nested span matches a broad include selector", () => {
    setHost("x.com")
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name" id="user-name">
          <div class="css-175oi2r">
            <span id="display-name" style="-webkit-line-clamp: 1">Read Frog</span>
            <span id="handle">@read_frog</span>
          </div>
        </div>
        <div data-testid="tweetText" id="tweet-text">
          <span>Translate this tweet</span>
        </div>
      </article>
    `

    walkAndLabelElement(document.body, "w1", structuredClone(DEFAULT_CONFIG))

    expect(document.querySelector("#user-name")!.hasAttribute(WALKED_ATTRIBUTE)).toBe(false)
    expect(document.querySelector("#display-name")!.hasAttribute(WALKED_ATTRIBUTE)).toBe(false)
    expect(document.querySelector("#display-name")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
    expect(document.querySelector("#handle")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
    expect(document.querySelector("#tweet-text")!.hasAttribute(WALKED_ATTRIBUTE)).toBe(true)
    expect(document.querySelector("#tweet-text")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
  })
})
