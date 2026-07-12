// @vitest-environment jsdom
import type { TransNode } from "@/types/dom"
import { describe, expect, it } from "vitest"
import { HTML_ATTRIBUTE_MARKER } from "../../html-attribute-markers"
import { protectTranslationHtmlAttributes } from "../translation-html-attributes"

function createNodes(html: string): TransNode[] {
  const container = document.createElement("div")
  container.innerHTML = html
  return Array.from(container.childNodes).filter(
    (node): node is TransNode => node.nodeType === Node.TEXT_NODE || node instanceof HTMLElement,
  )
}

describe("translation HTML attribute protection", () => {
  it("removes non-language attributes while retaining translatable and no-translate semantics", () => {
    const longToken = "utility-class-".repeat(80)
    const [link] = createNodes(
      `<a class="notranslate ${longToken}" translate="no" style="color: red" id="profile-link" data-state="${longToken}" href="https://example.com/${longToken}" title="Open profile" aria-label="Profile">Vancouver</a>`,
    )

    const protectedHtml = protectTranslationHtmlAttributes([link], document)

    expect(protectedHtml.requestHtml).toContain(`class="notranslate"`)
    expect(protectedHtml.requestHtml).toContain(`translate="no"`)
    expect(protectedHtml.requestHtml).toContain(`title="Open profile"`)
    expect(protectedHtml.requestHtml).toContain(`aria-label="Profile"`)
    expect(protectedHtml.requestHtml).toContain(`${HTML_ATTRIBUTE_MARKER}="0"`)
    expect(protectedHtml.requestHtml).not.toContain(longToken)
    expect(protectedHtml.requestHtml.length).toBeLessThan(protectedHtml.sourceHtml.length * 0.2)

    const restoredContainer = document.createElement("div")
    restoredContainer.innerHTML = protectedHtml.restore(
      `<a class="notranslate" translate="no" title="打开资料" aria-label="资料" data-rf-attr="0">Vancouver</a>`,
    )
    const restoredLink = restoredContainer.querySelector("a")
    expect(restoredLink?.className).toBe(`notranslate ${longToken}`)
    expect(restoredLink?.getAttribute("translate")).toBe("no")
    expect(restoredLink?.getAttribute("title")).toBe("打开资料")
    expect(restoredLink?.getAttribute("aria-label")).toBe("资料")
  })

  it("restores attributes after tags move and keeps translated human-readable attributes", () => {
    const nodes = createNodes(
      `I went to <strong class="place emphasized" style="color: red" data-place="yvr" title="City">Vancouver</strong> this Monday.`,
    )
    const protectedHtml = protectTranslationHtmlAttributes(nodes, document)

    const restored = protectedHtml.restore(
      `这个星期一我去了<strong data-rf-attr="0" title="城市" onclick="evil()">温哥华</strong><i onclick="evil()">。</i>`,
    )
    const container = document.createElement("div")
    container.innerHTML = restored
    const strong = container.querySelector("strong")

    expect(strong?.className).toBe("place emphasized")
    expect(strong?.getAttribute("style")).toBe("color: red")
    expect(strong?.getAttribute("data-place")).toBe("yvr")
    expect(strong?.getAttribute("title")).toBe("城市")
    expect(strong?.hasAttribute("onclick")).toBe(false)
    expect(container.querySelector("i")?.hasAttribute("onclick")).toBe(false)
    expect(container.textContent).toBe("这个星期一我去了温哥华。")
  })

  it("preserves translated button values while restoring input behavior attributes", () => {
    const [input] = createNodes(
      `<input type="submit" value="Send" class="primary action" disabled data-action="send">`,
    )
    const protectedHtml = protectTranslationHtmlAttributes([input], document)

    expect(protectedHtml.requestHtml).toBe(`<input value="Send" ${HTML_ATTRIBUTE_MARKER}="0">`)

    const container = document.createElement("div")
    container.innerHTML = protectedHtml.restore(
      `<input value="发送" data-rf-attr="0" onclick="evil()">`,
    )
    const restoredInput = container.querySelector("input")

    expect(restoredInput?.getAttribute("type")).toBe("submit")
    expect(restoredInput?.getAttribute("value")).toBe("发送")
    expect(restoredInput?.className).toBe("primary action")
    expect(restoredInput?.hasAttribute("disabled")).toBe(true)
    expect(restoredInput?.getAttribute("data-action")).toBe("send")
    expect(restoredInput?.hasAttribute("onclick")).toBe(false)
  })

  it("falls back to source text when a provider drops translatable attributes", () => {
    const [node] = createNodes(
      `<img class="avatar" src="avatar.png" alt="Profile photo" title="Open profile" aria-label="User avatar">`,
    )
    const protectedHtml = protectTranslationHtmlAttributes([node], document)
    const container = document.createElement("div")
    container.innerHTML = protectedHtml.restore(`<img data-rf-attr="0">`)
    const restored = container.querySelector("img")

    expect(restored?.getAttribute("alt")).toBe("Profile photo")
    expect(restored?.getAttribute("title")).toBe("Open profile")
    expect(restored?.getAttribute("aria-label")).toBe("User avatar")
    expect(restored?.className).toBe("avatar")
    expect(restored?.getAttribute("src")).toBe("avatar.png")
  })

  it("restores a source attribute that already uses the internal marker name", () => {
    const [node] = createNodes(
      `<span data-rf-attr="page-owned" class="badge" data-read-frog-walked="walk-id">Hello<!-- hidden -->world</span>`,
    )
    const protectedHtml = protectTranslationHtmlAttributes([node], document)

    expect(protectedHtml.sourceHtml).not.toContain("data-read-frog-walked")
    expect(protectedHtml.sourceHtml).toContain("Hello world")
    expect(protectedHtml.requestHtml).toContain(`data-rf-attr="0"`)

    const container = document.createElement("div")
    container.innerHTML = protectedHtml.restore(`<span data-rf-attr="0">你好世界</span>`)
    const restored = container.querySelector("span")

    expect(restored?.getAttribute("data-rf-attr")).toBe("page-owned")
    expect(restored?.className).toBe("badge")
  })

  it("escapes page-owned numeric markers only for legacy requests and restores them", () => {
    const nodes = createNodes(`<span data-rf-attr="0">Hello</span><b data-rf-attr="0">world</b>`)
    const protectedHtml = protectTranslationHtmlAttributes(nodes, document)

    expect(protectedHtml.sourceHtml).toContain(`data-rf-attr="0"`)
    expect(protectedHtml.legacyRequestHtml).toBe(
      `<span data-rf-attr="rf-page-0">Hello</span><b data-rf-attr="rf-page-1">world</b>`,
    )
    expect(
      protectedHtml.restoreLegacy(
        `<span data-rf-attr="rf-page-0">你好</span><b data-rf-attr="rf-page-1">世界</b>`,
      ),
    ).toBe(`<span data-rf-attr="0">你好</span><b data-rf-attr="0">世界</b>`)
  })

  it("restores parser-valid framework attributes without reparsing their names", () => {
    const [node] = createNodes(
      `<button @click="open = true" x-on:keydown="submit" wire:click="save">Open</button>`,
    )
    const protectedHtml = protectTranslationHtmlAttributes([node], document)

    const container = document.createElement("div")
    container.innerHTML = protectedHtml.restore(`<button data-rf-attr="0">打开</button>`)
    const restored = container.querySelector("button")

    expect(restored?.getAttribute("@click")).toBe("open = true")
    expect(restored?.getAttribute("x-on:keydown")).toBe("submit")
    expect(restored?.getAttribute("wire:click")).toBe("save")
  })

  it("serializes custom elements through inert template contents", () => {
    let constructorCalls = 0
    class CodecTestElement extends HTMLElement {
      constructor() {
        super()
        constructorCalls += 1
      }
    }
    customElements.define("rf-codec-test-element", CodecTestElement)
    const node = document.createElement("rf-codec-test-element")
    node.setAttribute("class", "hydrated-component")
    node.textContent = "Hello"

    expect(constructorCalls).toBe(1)
    protectTranslationHtmlAttributes([node], document)
    expect(constructorCalls).toBe(1)
  })

  it("restores nested same-name and void tags with entities, Unicode, and boolean attributes", () => {
    const nodes = createNodes(
      `<span class="outer">AT&amp;T 😀 <span class="inner" data-city="yvr">Vancouver</span></span><img class="avatar" src="avatar.png" hidden alt="Profile">`,
    )
    const protectedHtml = protectTranslationHtmlAttributes(nodes, document)
    const restored = protectedHtml.restore(
      `<img alt="头像" data-rf-attr="2"><span data-rf-attr="0"><span data-rf-attr="1">温哥华</span>的 AT&amp;T 😀</span>`,
    )
    const container = document.createElement("div")
    container.innerHTML = restored
    const spans = container.querySelectorAll("span")
    const image = container.querySelector("img")

    expect(spans).toHaveLength(2)
    expect(spans[0].className).toBe("outer")
    expect(spans[1].className).toBe("inner")
    expect(spans[1].getAttribute("data-city")).toBe("yvr")
    expect(container.textContent).toBe("温哥华的 AT&T 😀")
    expect(image).toBe(container.firstElementChild)
    expect(image?.className).toBe("avatar")
    expect(image?.getAttribute("src")).toBe("avatar.png")
    expect(image?.hasAttribute("hidden")).toBe(true)
    expect(image?.getAttribute("alt")).toBe("头像")
  })

  it("protects attributes and page-owned markers inside nested template contents", () => {
    const [node] = createNodes(
      `<div class="visible">Visible<template><span class="hidden-template-class" data-rf-attr="0">Hidden<!-- note --></span></template></div>`,
    )
    const protectedHtml = protectTranslationHtmlAttributes([node], document)

    expect(protectedHtml.requestHtml).toContain(`<div data-rf-attr="0">`)
    expect(protectedHtml.requestHtml).toContain(`<span data-rf-attr="1">Hidden </span>`)
    expect(protectedHtml.requestHtml).not.toContain("hidden-template-class")
    expect(protectedHtml.legacyRequestHtml).toContain(`data-rf-attr="rf-page-0"`)

    const container = document.createElement("div")
    container.innerHTML = protectedHtml.restore(
      `<div data-rf-attr="0">可见<template><span data-rf-attr="1">隐藏</span></template></div>`,
    )
    const restoredOuter = container.querySelector("div")
    const nestedTemplate = container.querySelector("template")
    const restoredInner = nestedTemplate?.content.querySelector("span")

    expect(restoredOuter?.className).toBe("visible")
    expect(restoredInner?.className).toBe("hidden-template-class")
    expect(restoredInner?.getAttribute("data-rf-attr")).toBe("0")
  })

  it("normalizes attribute order when comparing restored HTML with the source", () => {
    const [node] = createNodes(
      `<strong class="place" title="City" data-city="yvr">Vancouver</strong>`,
    )
    const protectedHtml = protectTranslationHtmlAttributes([node], document)
    const restored = protectedHtml.restore(
      `<strong title="City" data-rf-attr="0">Vancouver</strong>`,
    )

    expect(restored).not.toBe(protectedHtml.sourceHtml)
    expect(protectedHtml.normalizeForComparison(restored)).toBe(protectedHtml.comparisonSourceHtml)
  })

  it("uses deterministic skeletons with request-local restoration maps", () => {
    const first = protectTranslationHtmlAttributes(
      createNodes(`<strong class="first" data-owner="a">Vancouver</strong>`),
      document,
    )
    const second = protectTranslationHtmlAttributes(
      createNodes(`<strong class="second" data-owner="b">Vancouver</strong>`),
      document,
    )

    expect(first.requestHtml).toBe(second.requestHtml)

    const translated = `<strong data-rf-attr="0">温哥华</strong>`
    expect(first.restore(translated)).toContain(`class="first"`)
    expect(first.restore(translated)).toContain(`data-owner="a"`)
    expect(second.restore(translated)).toContain(`class="second"`)
    expect(second.restore(translated)).toContain(`data-owner="b"`)
  })

  it.each([
    ["missing", `<strong>温哥华</strong>`],
    ["duplicate", `<strong data-rf-attr="0">温</strong><strong data-rf-attr="0">哥华</strong>`],
    ["unknown", `<strong data-rf-attr="9">温哥华</strong>`],
    ["wrong tag", `<em data-rf-attr="0">温哥华</em>`],
  ])("rejects %s markers", (_, translatedHtml) => {
    const protectedHtml = protectTranslationHtmlAttributes(
      createNodes(`<strong class="place">Vancouver</strong>`),
      document,
    )

    expect(() => protectedHtml.restore(translatedHtml)).toThrowError(
      expect.objectContaining({ code: "HTML_ATTR_MARKER_INTEGRITY" }),
    )
  })
})
