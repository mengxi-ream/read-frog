// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { isWalkBlockedElement } from "../filter"
import { deepQueryTopLevelSelector } from "../find"
import { walkAndLabelElement, walkAndLabelElementChunked } from "../traversal"

const WALK_ATTRIBUTES = [
  "data-read-frog-walked",
  "data-read-frog-paragraph",
  "data-read-frog-block-node",
  "data-read-frog-inline-node",
] as const

function config(): Config {
  const value = structuredClone(DEFAULT_CONFIG)
  value.siteRules.userRules = [
    {
      id: "four-axis-parity",
      matches: window.location.hostname,
      forceBlockNodeSelectors: [".force-node-block"],
      forceInlineNodeSelectors: [".force-node-inline"],
      forceBlockStyleSelectors: [".force-style-block"],
      forceInlineStyleSelectors: [".force-style-inline"],
    },
  ]
  return value
}

/**
 * The parity fixture mixes every labeling-relevant shape: block/inline
 * elements, direct text, force-block tags, blocked subtrees (script, hidden,
 * sr-only, notranslate), empty containers, and a shadow host. Built by a
 * factory (not cloneNode) because clones don't carry shadow roots.
 */
function buildFixture(host: HTMLElement): void {
  host.innerHTML = `
    <div id="article">
      Direct text of article
      <em class="force-node-block">2026-07-17</em>
      <h2>Heading text</h2>
      <p class="force-node-inline">Paragraph with <span>inline span</span> and <strong>bold</strong> text.</p>
      <div>
        <p class="force-style-block">Nested paragraph one</p>
        <ul><li>item one</li><li>item <b>two</b></li></ul>
      </div>
      <em class="force-style-block style-block-only">style-only inline element</em>
      <div class="force-style-inline style-inline-only">style-only block element</div>
      <div class="empty-container"><div></div></div>
      <script>ignored()</script>
      <section hidden><p>hidden text</p></section>
      <span class="sr-only">screen reader only</span>
      <div class="notranslate">do not translate</div>
      <p></p>
    </div>
  `
  const article = host.firstElementChild as HTMLElement
  const shadowHost = document.createElement("div")
  article.append(shadowHost)
  const shadowRoot = shadowHost.attachShadow({ mode: "open" })
  const shadowParagraph = document.createElement("p")
  shadowParagraph.textContent = "shadow paragraph"
  const shadowHidden = document.createElement("div")
  shadowHidden.hidden = true
  shadowHidden.textContent = "hidden in shadow"
  shadowRoot.append(shadowParagraph, shadowHidden)
}

/** DFS snapshot of every element's walk labels, shadow trees included. */
function snapshotLabels(root: HTMLElement, walkId: string): string[] {
  const lines: string[] = []
  const visit = (element: Element, path: string) => {
    const labels = WALK_ATTRIBUTES.map((attribute) => {
      const value = element.getAttribute(attribute)
      if (value === null) return `${attribute}=∅`
      // Normalize walk ids so runs with different ids compare equal.
      return attribute === "data-read-frog-walked"
        ? `${attribute}=${value === walkId ? "SET" : "OTHER"}`
        : `${attribute}=${value}`
    }).join(" ")
    lines.push(`${path}<${element.tagName.toLowerCase()}> ${labels}`)
    if (element instanceof HTMLElement && element.shadowRoot) {
      ;[...element.shadowRoot.children].forEach((child, index) =>
        visit(child, `${path}#shadow/${index}/`),
      )
    }
    ;[...element.children].forEach((child, index) => visit(child, `${path}${index}/`))
  }
  visit(root, "")
  return lines
}

describe("walkAndLabelElementChunked parity", () => {
  it("labels identically to the synchronous walk even when yielding at every element", async () => {
    const syncHost = document.createElement("div")
    const chunkedHost = document.createElement("div")
    document.body.append(syncHost, chunkedHost)
    buildFixture(syncHost)
    buildFixture(chunkedHost)

    const syncResult = walkAndLabelElement(syncHost, "sync-walk", config())
    // budgetMs: 0 forces a yield at every single element — the worst case.
    const chunkedResult = await walkAndLabelElementChunked(chunkedHost, "chunked-walk", config(), {
      budgetMs: 0,
    })

    expect(chunkedResult).toEqual(syncResult)
    expect(snapshotLabels(chunkedHost, "chunked-walk")).toEqual(
      snapshotLabels(syncHost, "sync-walk"),
    )
    for (const host of [syncHost, chunkedHost]) {
      expect(host.querySelector(".style-block-only")).toHaveAttribute("data-read-frog-inline-node")
      expect(host.querySelector(".style-block-only")).not.toHaveAttribute(
        "data-read-frog-block-node",
      )
      expect(host.querySelector(".style-inline-only")).toHaveAttribute("data-read-frog-block-node")
      expect(host.querySelector(".style-inline-only")).not.toHaveAttribute(
        "data-read-frog-inline-node",
      )
    }

    syncHost.remove()
    chunkedHost.remove()
  })

  it("reports the same blocked elements as deepQueryTopLevelSelector", async () => {
    const host = document.createElement("div")
    document.body.append(host)
    buildFixture(host)
    const cfg = config()

    const expected = deepQueryTopLevelSelector(host, (element) =>
      isWalkBlockedElement(element, cfg),
    )

    const reported: HTMLElement[] = []
    await walkAndLabelElementChunked(host, "walk", cfg, {
      budgetMs: 0,
      onBlockedElement: (element) => reported.push(element),
    })

    expect(new Set(reported)).toEqual(new Set(expected))
    expect(reported.length).toBeGreaterThan(0)

    host.remove()
  })

  it("aborts cleanly at a slice boundary when shouldContinue flips false", async () => {
    const host = document.createElement("div")
    document.body.append(host)
    buildFixture(host)

    let checks = 0
    const result = await walkAndLabelElementChunked(host, "aborted-walk", config(), {
      budgetMs: 0,
      shouldContinue: () => {
        checks += 1
        return checks <= 3
      },
    })

    expect(result).toBeNull()

    const walked = host.querySelectorAll('[data-read-frog-walked="aborted-walk"]').length
    const total = host.querySelectorAll("*").length
    // A prefix was labeled, the rest was never touched, and no element got a
    // paragraph/block/inline label without the walked marker.
    expect(walked).toBeGreaterThan(0)
    expect(walked).toBeLessThan(total)
    for (const labeled of host.querySelectorAll(
      "[data-read-frog-paragraph], [data-read-frog-block-node], [data-read-frog-inline-node]",
    )) {
      expect(labeled.getAttribute("data-read-frog-walked")).toBe("aborted-walk")
    }

    host.remove()
  })

  it("invokes onBlockedElement for a blocked root without walking it", async () => {
    const host = document.createElement("div")
    host.hidden = true
    host.innerHTML = "<p>invisible</p>"
    document.body.append(host)

    const reported: HTMLElement[] = []
    const result = await walkAndLabelElementChunked(host, "walk", config(), {
      onBlockedElement: (element) => reported.push(element),
    })

    expect(result).toEqual({ forceBlock: false, isInlineNode: false })
    expect(reported).toEqual([host])
    expect(host.hasAttribute("data-read-frog-walked")).toBe(false)

    host.remove()
  })
})
