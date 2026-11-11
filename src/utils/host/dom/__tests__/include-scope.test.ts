// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import type { SiteRule } from "@/types/config/site-rules"
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { PARAGRAPH_ATTRIBUTE, WALKED_ATTRIBUTE } from "@/utils/constants/dom-labels"
import { extractTextContent, walkAndLabelElement } from "../traversal"

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

  it("labels a YouTube watch title when the A/B layout has no h1 ancestor", () => {
    setUrl("https://www.youtube.com/watch?v=video-id")
    document.body.innerHTML = `
      <div id="title-row">
        <yt-formatted-string class="ytd-watch-metadata" id="watch-title">
          A visible video title rendered without a heading wrapper
        </yt-formatted-string>
      </div>
    `

    const title = document.querySelector("#watch-title") as HTMLElement
    walkAndLabelElement(title, "hover-walk", structuredClone(DEFAULT_CONFIG))

    expect(title.hasAttribute(WALKED_ATTRIBUTE)).toBe(true)
    expect(title.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
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

  // Regression: the current issue list renders titles as
  // <a data-testid="issue-listitem-title-link"> with no hovercard attribute,
  // so only a testid include selector brings them into the whitelist.
  it("labels github issue-list titles that only carry the issue-listitem testid", () => {
    setHost("github.com")
    document.body.innerHTML = `
      <ul>
        <li>
          <h3><a data-testid="issue-listitem-title-link" href="/HakanSeven12/OpenCADStudio/issues/1878" id="issue-title"><span><span data-component="Text">[REQ] OsnapZ Replace Z value with current elevation</span></span></a></h3>
        </li>
      </ul>
    `

    walkAndLabelElement(document.body, "w1", structuredClone(DEFAULT_CONFIG))

    expect(document.querySelector("#issue-title")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
  })

  // Markup trimmed from lowendtalk.com (Vanilla Forums): the category list,
  // a search result, a comment and the sidebar. The built-in rule used to
  // whitelist headings, post bodies, the sidebar and discussion-list meta, so
  // descriptions, search results and comment headers were never labeled.
  it("labels LowEndTalk descriptions, search results and comment headers but not usernames", () => {
    setUrl("https://lowendtalk.com/categories")
    document.body.innerHTML = `
      <div class="Column PanelColumn" id="Panel">
        <div class="Box BoxInThisDiscussion">
          <h4 id="panel-heading">In this Discussion</h4>
          <ul class="PanelInfo PanelInThisDiscussion" id="participants">
            <li><a href="/profile/batra"><span class="Aside"><span><time>12:21PM</time></span></span> <span><span class="Username">batra</span></span></a></li>
          </ul>
        </div>
      </div>
      <div class="Column ContentColumn">
        <div class="P PageDescription" id="page-description">LowEndTalk is a leading community forum for hosting professionals and enthusiasts.</div>
        <div class="ItemContent Category">
          <div role="heading" aria-level="3" class="TitleWrap"><a href="/categories/offers" class="Title">Offers</a></div>
          <div class="CategoryDescription" id="category-description">Hosting providers may post promotional offers that meet community rules.</div>
        </div>
        <ol id="search-results">
          <li class="Item-Search">
            <h3 id="search-title"><a href="/discussion/1">Paid for a dedicated server, still waiting on delivery</a></h3>
            <div class="Media-Body"><div class="Summary" id="search-summary">The provider has not answered a ticket in two weeks.</div></div>
          </li>
        </ol>
        <div class="Comment">
          <div class="Item-Header CommentHeader">
            <div class="AuthorWrap" id="author-wrap">
              <span class="Author" id="author"><a href="/profile/PuDLeZ" class="PhotoWrap" title="PuDLeZ"><img alt="PuDLeZ"></a><a href="/profile/PuDLeZ" class="Username" id="username">PuDLeZ</a></span>
              <span class="AuthorInfo"><span class="MItem RoleTitle">Member</span></span>
            </div>
          </div>
          <div class="Message userContent"><p id="comment-body">Thanks for running the giveaway again.</p></div>
          <div class="ThankedByBox" id="thanked-by"><span class="ThankedBy">Thanked by <span>2</span></span><a href="/profile/dsbnoob">dsbnoob</a> <a href="/profile/noob404">noob404</a></div>
        </div>
      </div>
    `

    walkAndLabelElement(document.body, "w1", structuredClone(DEFAULT_CONFIG))

    const has = (id: string, attribute: string) =>
      document.getElementById(id)!.hasAttribute(attribute)
    const unlabeled = [
      "page-description",
      "category-description",
      "search-title",
      "search-summary",
      "author-wrap",
      "comment-body",
      "panel-heading",
    ].filter((id) => !has(id, PARAGRAPH_ATTRIBUTE))
    const walkedNames = ["author", "username", "thanked-by", "participants"].filter((id) =>
      has(id, WALKED_ATTRIBUTE),
    )

    expect(unlabeled).toEqual([])
    expect(walkedNames).toEqual([])
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

  // Logged-out x.com serves a Tailwind web app with no data-testid attributes,
  // so none of the twitter rule's older selectors match it (issue #2483). Post
  // text, quoted posts, link-card descriptions, and the profile bio all render
  // as div[dir=auto].whitespace-pre-wrap; names, handles, and timestamps carry
  // neither marker, and the trends sidebar sits outside <main>.
  it("labels X web app posts and bios that carry no data-testid (issue #2483)", () => {
    setUrl("https://x.com/superalesha/status/2119911942227959883")
    document.body.innerHTML = `
      <main>
        <div>
          <span class="max-w-full text-body font-normal text-secondary line-clamp-1" id="profile-handle">@superalesha</span>
          <div dir="auto" class="max-w-full text-body font-normal text-primary whitespace-pre-wrap wrap-anywhere" id="bio"><span>Writing GPU kernels and reading launch posts</span></div>
        </div>
        <section>
          <ul>
            <li>
              <article class="flex flex-col gap-1">
                <a href="/superalesha">
                  <div class="max-w-full text-body font-bold text-primary line-clamp-1 break-all min-w-0" id="display-name">Alexey Fateev</div>
                  <span class="max-w-full text-body font-normal text-secondary line-clamp-1" id="handle">@superalesha</span>
                </a>
                <div dir="auto" class="max-w-full text-lead font-normal text-primary whitespace-pre-wrap wrap-anywhere" id="post-text"><span>Kernel optimization now sits next to hacking in the safeguards section, says </span><a href="/AnthropicAI" class="rounded-xs x-link" id="mention">@AnthropicAI</a><button class="max-w-full font-normal text-brand" id="show-more">Show more</button></div>
                <a href="/superalesha/status/2119911942227959883" class="rounded-xs x-link" id="timestamp">2:56 PM · Nov 9, 2026</a>
              </article>
            </li>
          </ul>
        </section>
      </main>
      <aside>
        <section>
          <div role="link">
            <div dir="auto" class="max-w-full text-body font-normal text-primary line-clamp-3 whitespace-pre-wrap wrap-anywhere" id="trend">how far can 4x RTX 3090s go?</div>
          </div>
        </section>
      </aside>
    `
    const config = structuredClone(DEFAULT_CONFIG)

    walkAndLabelElement(document.body, "w1", config)

    const postText = document.querySelector("#post-text") as HTMLElement
    expect(postText.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    expect(document.querySelector("#bio")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    const labeledChrome = ["display-name", "handle", "profile-handle", "timestamp", "trend"].filter(
      (id) => document.querySelector(`#${id}`)!.hasAttribute(PARAGRAPH_ATTRIBUTE),
    )
    expect(labeledChrome).toEqual([])
    // Mentions stay inline in the post's source text; the "Show more" button
    // inside the post body does not.
    const sourceText = extractTextContent(postText, config)
    expect(sourceText).toContain("@AnthropicAI")
    expect(sourceText).not.toContain("Show more")
  })

  it("labels repository descriptions in GitHub's React org repository list (issue #2483)", () => {
    setUrl("https://github.com/orgs/facebookresearch/repositories")
    document.body.innerHTML = `
      <h1 id="org-name">Meta Research</h1>
      <main>
        <ul>
          <li class="listItem__X41oTe">
            <div class="container__W45oI6">
              <h3><a href="/facebookresearch/atlas" data-testid="list-row-repo-name-and-number" id="repo-name">atlas</a></h3>
              <div class="repos-list-description width-full FormattedDescription__JqeVHv">
                <div class="prc-Truncate-Truncate-2G1eo" title="ATLAS Autoformalized Textbook Library At Scale" id="description">ATLAS Autoformalized Textbook Library At Scale</div>
              </div>
            </div>
          </li>
        </ul>
      </main>
    `

    walkAndLabelElement(document.body, "w1", structuredClone(DEFAULT_CONFIG))

    expect(document.querySelector("#description")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    expect(document.querySelector("#org-name")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    expect(document.querySelector("#repo-name")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
  })
})
