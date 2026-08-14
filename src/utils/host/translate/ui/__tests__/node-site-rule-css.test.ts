// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { beginPageTranslationSession, endPageTranslationSession } from "../../translation-session"
import {
  beginNodeSiteRuleCSSOperation,
  cleanupNodeSiteRuleCSSIfUnused,
} from "../node-site-rule-css"

const SITE_RULE_CSS = ".clamped-title { max-height: none !important; }"
const SITE_RULE_STYLE_SELECTOR = "#read-frog-site-rule-styles"

function createTranslationWrapper(): HTMLElement {
  const wrapper = document.createElement("span")
  wrapper.className = CONTENT_WRAPPER_CLASS
  return wrapper
}

async function flushMutationObserver(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("node site-rule CSS lifecycle", () => {
  beforeEach(() => {
    endPageTranslationSession()
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    Object.defineProperty(document, "adoptedStyleSheets", {
      configurable: true,
      value: undefined,
    })
  })

  afterEach(() => {
    endPageTranslationSession()
    document.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`).forEach((wrapper) => wrapper.remove())
    cleanupNodeSiteRuleCSSIfUnused(document)
  })

  it("keeps CSS while another node translation operation is pending", async () => {
    const releaseFirst = await beginNodeSiteRuleCSSOperation(document, SITE_RULE_CSS)
    const releaseSecond = await beginNodeSiteRuleCSSOperation(document, SITE_RULE_CSS)

    await releaseFirst()

    expect(document.head.querySelector(SITE_RULE_STYLE_SELECTOR)).not.toBeNull()

    const wrapper = createTranslationWrapper()
    document.body.appendChild(wrapper)
    await releaseSecond()

    expect(document.head.querySelector(SITE_RULE_STYLE_SELECTOR)).not.toBeNull()
  })

  it("cleans ShadowRoot CSS even while a document page session is active", async () => {
    beginPageTranslationSession()
    const host = document.createElement("div")
    const shadowRoot = host.attachShadow({ mode: "open" })
    Object.defineProperty(shadowRoot, "adoptedStyleSheets", {
      configurable: true,
      value: undefined,
    })
    document.body.appendChild(host)

    const release = await beginNodeSiteRuleCSSOperation(shadowRoot, SITE_RULE_CSS)
    expect(shadowRoot.querySelector(SITE_RULE_STYLE_SELECTOR)).not.toBeNull()

    await release()

    expect(shadowRoot.querySelector(SITE_RULE_STYLE_SELECTOR)).toBeNull()
  })

  it("removes CSS after the host discards the last translated subtree", async () => {
    const release = await beginNodeSiteRuleCSSOperation(document, SITE_RULE_CSS)
    const translatedSubtree = document.createElement("div")
    translatedSubtree.appendChild(createTranslationWrapper())
    document.body.appendChild(translatedSubtree)
    await release()

    expect(document.head.querySelector(SITE_RULE_STYLE_SELECTOR)).not.toBeNull()

    translatedSubtree.remove()
    await flushMutationObserver()

    expect(document.head.querySelector(SITE_RULE_STYLE_SELECTOR)).toBeNull()
  })

  it("reconciles retained node CSS after a document page session stops", async () => {
    beginPageTranslationSession()
    const release = await beginNodeSiteRuleCSSOperation(document, SITE_RULE_CSS)
    await release()

    expect(document.head.querySelector(SITE_RULE_STYLE_SELECTOR)).not.toBeNull()

    endPageTranslationSession()
    cleanupNodeSiteRuleCSSIfUnused(document)

    expect(document.head.querySelector(SITE_RULE_STYLE_SELECTOR)).toBeNull()
  })
})
