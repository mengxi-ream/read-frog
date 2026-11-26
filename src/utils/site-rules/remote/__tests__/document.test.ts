import type { RemoteSiteRulesDocument } from "../document"
import type { SiteRule } from "@/types/config/site-rules"
import { describe, expect, it } from "vitest"
import { resolveSiteRule } from "../../resolve"
import {
  compareExtensionVersions,
  isRemoteCssAllowed,
  parseRemoteSiteRule,
  selectBuiltInSiteRules,
} from "../document"

const BUNDLED: SiteRule[] = [
  { id: "a", matches: "a.com", excludeSelectors: [".bundled-a"] },
  { id: "b", matches: "b.com", excludeSelectors: [".bundled-b"] },
]

function remoteDocument(rules: unknown[], extensionVersion = "1.58.1"): RemoteSiteRulesDocument {
  return { format: 1, revision: 1_762_800_000, extensionVersion, rules }
}

describe("compareExtensionVersions", () => {
  it.each([
    ["1.58.1", "1.58.1", 0],
    ["1.58.1", "1.58.2", -1],
    ["1.59.0", "1.58.9", 1],
    ["1.10.0", "1.9.0", 1],
    ["1.58", "1.58.0", 0],
  ])("compares %s with %s", (left, right, sign) => {
    expect(Math.sign(compareExtensionVersions(left, right))).toBe(sign)
  })
})

describe("selectBuiltInSiteRules", () => {
  it("keeps the bundled rules without a document", () => {
    expect(selectBuiltInSiteRules(BUNDLED, null, "1.58.1")).toBe(BUNDLED)
  })

  it("keeps the bundled rules when the document predates this build", () => {
    // Published while 1.58.1 was the latest release: 1.59.0 bundles those
    // rules or newer ones.
    const remote = remoteDocument([{ id: "a", matches: "a.com" }], "1.58.1")
    expect(selectBuiltInSiteRules(BUNDLED, remote, "1.59.0")).toBe(BUNDLED)
  })

  it("uses the whole document in its order, so a rule left out stops applying", () => {
    const rules = [
      { id: "c", matches: "c.com" },
      { id: "a", matches: "a.com", excludeSelectors: [".remote-a"] },
    ]
    expect(selectBuiltInSiteRules(BUNDLED, remoteDocument(rules), "1.58.1")).toEqual(rules)
    // Builds newer than the document's release take it too.
    expect(selectBuiltInSiteRules(BUNDLED, remoteDocument(rules, "1.58.1"), "1.58.0")).toEqual(
      rules,
    )
  })

  it("falls back to the bundled copy of a rule that uses a field this build does not know", () => {
    const selected = selectBuiltInSiteRules(
      BUNDLED,
      remoteDocument([
        { id: "a", matches: "a.com", excludeSelectors: [".remote-a"], scopeFromTheFuture: true },
        // Without the field that narrows it, this would apply on every page.
        {
          id: "new",
          matches: "<all_urls>",
          scopeFromTheFuture: true,
          "dontWalkTags.remove": ["PRE"],
        },
      ]),
      "1.58.1",
    )
    expect(selected).toEqual([BUNDLED[0]])
  })

  it("falls back for a rule that needs a newer build, and takes it once the build is new enough", () => {
    // Published after 1.58.2 came out, so both builds read it.
    const remote = remoteDocument(
      [
        {
          id: "a",
          matches: "a.com",
          excludeSelectors: [".remote-a"],
          minExtensionVersion: "1.58.2",
        },
        { id: "c", matches: "c.com", minExtensionVersion: "1.58.2" },
      ],
      "1.58.2",
    )
    expect(selectBuiltInSiteRules(BUNDLED, remote, "1.58.1")).toEqual([BUNDLED[0]])
    expect(selectBuiltInSiteRules(BUNDLED, remote, "1.58.2")).toEqual([
      { id: "a", matches: "a.com", excludeSelectors: [".remote-a"] },
      { id: "c", matches: "c.com" },
    ])
  })

  it("falls back for a rule whose CSS loads something", () => {
    const selected = selectBuiltInSiteRules(
      BUNDLED,
      remoteDocument([
        { id: "a", matches: "a.com", injectedCss: "input { background: url(https://x.test/) }" },
        { id: "c", matches: "c.com", "injectedCss.add": [".c { color: red }", "@import 'x.css';"] },
      ]),
      "1.58.1",
    )
    expect(selected).toEqual([BUNDLED[0]])
  })

  it("keeps the first of duplicate ids and skips malformed rules", () => {
    const selected = selectBuiltInSiteRules(
      BUNDLED,
      remoteDocument([
        { id: "c", matches: "c.com" },
        { id: "c", matches: "other.com" },
        { matches: "no-id.com" },
        "not a rule",
        { id: "b", matches: 42 },
      ]),
      "1.58.1",
    )
    expect(selected).toEqual([{ id: "c", matches: "c.com" }, BUNDLED[1]])
  })
})

describe("parseRemoteSiteRule", () => {
  it("drops the version field from the rule it returns", () => {
    expect(
      parseRemoteSiteRule({ id: "a", matches: "a.com", minExtensionVersion: "1.0" }, "1.0"),
    ).toEqual({
      id: "a",
      matches: "a.com",
    })
  })

  it("refuses a malformed minimum version", () => {
    expect(
      parseRemoteSiteRule({ id: "a", matches: "a.com", minExtensionVersion: "next" }, "1.0"),
    ).toBeNull()
  })

  it.each(["input[value^=a]{background:\\75", "input[value^=a]{background:\\75\r"])(
    "refuses a url( split across a rule's CSS blocks after %j",
    (firstHalf) => {
      expect(
        parseRemoteSiteRule(
          {
            id: "split",
            matches: "x.test",
            injectedCss: firstHalf,
            "injectedCss.add": ["rl(https://x.test/a)}"],
          },
          "1.0",
        ),
      ).toBeNull()
    },
  )
})

describe("remote rule CSS once joined for a page", () => {
  const SECOND_HALF = "rl(https://x.test/a)}"

  function resolveTwoRules(firstHalf: string) {
    const selected = selectBuiltInSiteRules(
      [],
      {
        format: 1,
        revision: 1,
        extensionVersion: "1.0",
        rules: [
          { id: "everywhere", matches: "<all_urls>", injectedCss: firstHalf },
          { id: "site", matches: "x.test", injectedCss: SECOND_HALF },
        ],
      },
      "1.0",
    )
    return resolveSiteRule("https://x.test/", selected, [], [])
  }

  it.each([
    "input[value^=a]{background:\\75",
    // The CR and the joining LF read as one CR LF, which the escape takes.
    "input[value^=a]{background:\\75\r",
  ])("cannot be split into a url( across two matching rules after %j", (firstHalf) => {
    // Joined the way resolveSiteRule joins them, the halves read as url(.
    expect(isRemoteCssAllowed([firstHalf, SECOND_HALF].join("\n"))).toBe(false)

    const resolved = resolveTwoRules(firstHalf)

    expect(resolved.matchedRuleIds).toEqual(["site"])
    expect(isRemoteCssAllowed(resolved.injectedCss ?? "")).toBe(true)
  })

  it.each([
    "input[value^=a]{background:\\75 ",
    "input[value^=a]{background:\\75\r\n",
    "input[value^=a]{background:\\75\f",
  ])("keeps both rules when the escape ends inside its own block: %j", (firstHalf) => {
    const resolved = resolveTwoRules(firstHalf)

    expect(resolved.matchedRuleIds).toEqual(["everywhere", "site"])
    expect(isRemoteCssAllowed(resolved.injectedCss ?? "")).toBe(true)
  })
})

describe("isRemoteCssAllowed", () => {
  it.each([
    ".a { display: none !important; }",
    '.a::before { content: "\\2014"; }',
    ".a { background-image: linear-gradient(red, blue); }",
    ".a { -webkit-line-clamp: unset !important; }",
    // An escape finished by whitespace inside the block takes nothing from the join.
    ".a { x: \\75 }",
    ".a { x: y } \\75\r\n",
    // An FF or a second CR is a newline of its own: the escape takes it and leaves
    // the joining one.
    ".a { x: y } \\75\f",
    ".a { x: y } \\75\r\r",
    // An even run of backslashes is escaped backslashes, not an escape.
    ".a { x: y } \\\\75",
  ])("allows %s", (css) => {
    expect(isRemoteCssAllowed(css)).toBe(true)
  })

  it.each([
    "input[value^='a'] { background: url(https://x.test/a) }",
    ".a { background: URL(x) }",
    ".a { background: \\75 rl(x) }",
    ".a { background: u\\72l(x) }",
    // A hex escape takes one whitespace after it, and CSS reads CR LF, a lone
    // CR and FF each as a single LF before that.
    ".a { background: \\75\r\nrl(x) }",
    ".a { background: \\75\rrl(x) }",
    ".a { background: \\75\frl(x) }",
    ".a { background: \\75\nrl(x) }",
    ".a { background: image-\\73\r\net('x.png' 1x) }",
    // A block ending in an unfinished hex escape would take the newline that
    // joins it to the next rule's CSS.
    ".a { background: \\75",
    "@\\69",
    "x: image-\\73",
    ".a { x: y } \\000075",
    ".a { x: y } \\\\\\75",
    // So would one ending in the escape and a lone CR, which forms one CR LF with
    // that newline.
    ".a { background: \\75\r",
    "@\\69\r",
    "@import 'https://x.test/x.css';",
    "@\\69mport 'x.css';",
    "@\\69\r\nmport 'x.css';",
    ".a { background: image-set('x.png' 1x) }",
    ".a { cursor: -webkit-image-set('x.png' 1x), auto }",
    ".a { background: image('x.png') }",
    ".a { background: src('x.png') }",
    "@font-face { font-family: x; src: url(x.woff) }",
  ])("refuses %s", (css) => {
    expect(isRemoteCssAllowed(css)).toBe(false)
  })
})
