import type { Config } from "@/types/config/config"
// @vitest-environment jsdom
import type { TranslationMode } from "@/types/config/translate"
import { act, render, screen, waitFor } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BLOCK_ATTRIBUTE,
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  FLOAT_WRAP_ATTRIBUTE,
  INLINE_ATTRIBUTE,
  INLINE_CONTENT_CLASS,
  PARAGRAPH_ATTRIBUTE,
  TRANSLATION_ERROR_CONTAINER_CLASS,
  TRANSLATION_ONLY_ATTRIBUTE,
  VIRTUAL_PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { flushBatchedOperations } from "@/utils/host/dom/batch-dom"
import { walkAndLabelElement } from "@/utils/host/dom/traversal"
import {
  removeAllTranslatedWrapperNodes,
  translateNodeTranslationOnlyMode,
  translateNodesBilingualMode,
  translateWalkedElement,
} from "@/utils/host/translate/node-manipulation"
import { translateTextForPage } from "@/utils/host/translate/translate-variants"
import {
  expectInPlaceTranslation,
  expectNodeLabels,
  expectTranslatedContent,
  expectTranslationWrapper,
  MOCK_ORIGINAL_TEXT,
  MOCK_TRANSLATION,
} from "./utils"

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: vi.fn<(...args: any[]) => any>(() => Promise.resolve(MOCK_TRANSLATION)),
}))

const BILINGUAL_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  translate: {
    ...DEFAULT_CONFIG.translate,
    mode: "bilingual" as const,
  },
}

const TRANSLATION_ONLY_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  translate: {
    ...DEFAULT_CONFIG.translate,
    mode: "translationOnly" as const,
  },
}

function setHost(host: string) {
  Object.defineProperty(window, "location", {
    value: new URL(`https://${host}/some/path`),
    writable: true,
    configurable: true,
  })
}

async function withHost(host: string, callback: () => Promise<void>) {
  const originalLocation = window.location
  setHost(host)
  try {
    await callback()
  } finally {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
  }
}

function createRect({
  top,
  left,
  width,
  height,
}: {
  top: number
  left: number
  width: number
  height: number
}): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {
      return {
        top,
        left,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
      }
    },
  }
}

describe("translate", () => {
  // Setup and teardown for getComputedStyle mock
  const originalGetComputedStyle = window.getComputedStyle

  beforeAll(() => {
    window.getComputedStyle = vi.fn<(...args: any[]) => any>((element) => {
      const originalStyle = originalGetComputedStyle(element)

      // Check if element has inline style float property
      const inlineFloat = (element as HTMLElement).style?.float

      if (originalStyle.float === "") {
        Object.defineProperty(originalStyle, "float", {
          // Use inline style float if present, otherwise default to 'none'
          value: inlineFloat || "none",
          writable: true,
          enumerable: true,
          configurable: true,
        })
      }
      return originalStyle
    })
  })

  afterAll(() => {
    window.getComputedStyle = originalGetComputedStyle
  })

  // Helper functions
  async function removeOrShowPageTranslation(
    translationMode: TranslationMode,
    toggle: boolean = false,
    config?: Config,
  ) {
    const id = crypto.randomUUID()
    const effectiveConfig =
      config ?? (translationMode === "bilingual" ? BILINGUAL_CONFIG : TRANSLATION_ONLY_CONFIG)

    walkAndLabelElement(document.body, id, effectiveConfig)
    await act(async () => {
      await translateWalkedElement(document.body, id, effectiveConfig, toggle)
      // Flush batched DOM operations to ensure all changes are applied before assertions
      flushBatchedOperations()
    })
  }

  async function waitForTranslationError(wrapper: Element | null) {
    await waitFor(() => {
      expect(wrapper?.querySelector(`.${TRANSLATION_ERROR_CONTAINER_CLASS}`)).toBeTruthy()
    })
  }

  describe("translateTextForPage stub", () => {
    it("translateTextForPage should be mocked", async () => {
      expect(await translateTextForPage("任何文字")).toBe(MOCK_TRANSLATION)
    })
  })

  describe("block node with single child node", () => {
    describe("text node", () => {
      it("bilingual mode: should insert translation wrapper after original text node", async () => {
        render(<div data-testid="test-node">{MOCK_ORIGINAL_TEXT}</div>)
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.childNodes[1])
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it("translation only mode: should swap original text in place", async () => {
        render(<div data-testid="test-node">{MOCK_ORIGINAL_TEXT}</div>)
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectInPlaceTranslation(node)

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node).not.toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe("inline HTML node", () => {
      it("bilingual mode: should keep block layout when inserting inside an inline child", async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it("translation only mode: should swap inline node text in place", async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectInPlaceTranslation(node.children[0])

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.querySelector(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe("block node", () => {
      it("bilingual mode: should insert translation wrapper after child block node content", async () => {
        render(
          <div data-testid="test-node">
            <div>{MOCK_ORIGINAL_TEXT}</div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it("translation only mode: should swap child block node text in place", async () => {
        render(
          <div data-testid="test-node">
            <div>{MOCK_ORIGINAL_TEXT}</div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectInPlaceTranslation(node.children[0])

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.querySelector(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe("block node -> block node -> inline node", () => {
      it("bilingual mode: should keep block layout when inserting after the deepest inline node", async () => {
        render(
          <div data-testid="test-node">
            <div>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.childNodes[0].childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it("translation only mode: should swap deepest inline node text in place", async () => {
        render(
          <div data-testid="test-node">
            <div>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectInPlaceTranslation(node.children[0].children[0])

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.querySelector(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe("block node -> shallow inline node (block node) -> block node", () => {
      it("bilingual mode: should insert translation wrapper after deepest block node content", async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>
              <div>{MOCK_ORIGINAL_TEXT}</div>
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.childNodes[0].childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it("translation only mode: should swap deepest block node text in place", async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>
              <div>{MOCK_ORIGINAL_TEXT}</div>
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectInPlaceTranslation(node.children[0].children[0])

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.querySelector(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe("block node -> shallow inline node -> inline node", () => {
      it("bilingual mode: should keep the outer block layout after unwrapping nested inline nodes", async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.childNodes[0].childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it("translation only mode: should swap nested inline node text in place", async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectInPlaceTranslation(node.children[0].children[0])

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.querySelector(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe("block node -> shallow inline node (inline node) -> inline node + inline node", () => {
      it("bilingual mode: should keep the outer block layout when insertion stops at the inline parent", async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
              {MOCK_ORIGINAL_TEXT}
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.childNodes[0].childNodes[2])
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it("translation only mode: should replace parent inline node content with translation wrapper", async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
              {MOCK_ORIGINAL_TEXT}
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "translationOnly")
        expect(wrapper).toBe(node.childNodes[0].childNodes[0])

        await removeOrShowPageTranslation("translationOnly", true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
    })
    describe("block node -> shallow inline node (inline node) -> single inline node + block node", () => {
      it("bilingual mode: should translate the unwrapped inline parent with the outer block layout", async () => {
        // https://github.com/mengxi-ream/read-frog/pull/1055
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
              <div>{MOCK_ORIGINAL_TEXT}</div>
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[1], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node.children[0], "bilingual")
        expect(wrapper).toBe(node.children[0].lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
        expect(node.children[0].querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it("translation only mode: should replace the unwrapped inline parent content with a single wrapper", async () => {
        // https://github.com/mengxi-ream/read-frog/pull/1055
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
              <div>{MOCK_ORIGINAL_TEXT}</div>
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node.children[0], "translationOnly")
        expect(wrapper).toBe(node.children[0].firstChild)
        expect(node.children[0].children).toHaveLength(1)

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      })
    })
    describe("block node -> shallow inline node (inline node) -> inline nodes + block node", () => {
      it("bilingual mode: should translate the unwrapped inline parent as one block wrapper", async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
              <div>{MOCK_ORIGINAL_TEXT}</div>
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[1], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[2], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node.children[0], "bilingual")
        expect(wrapper).toBe(node.children[0].lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
        expect(node.children[0].querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      })
      it("translation only mode: should replace the unwrapped inline parent content with one wrapper", async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
              <div>{MOCK_ORIGINAL_TEXT}</div>
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node.children[0], "translationOnly")
        expect(wrapper).toBe(node.children[0].firstChild)
        expect(node.children[0].children).toHaveLength(1)

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      })
    })
  })

  describe("real-world only-child layout regressions", () => {
    describe("X tweet text", () => {
      const getTranslationWrappers = (tweet: HTMLElement) => [
        ...tweet.querySelectorAll<HTMLElement>(`.${CONTENT_WRAPPER_CLASS}`),
      ]

      const expectBlockTranslations = (tweet: HTMLElement, translations: string[]) => {
        const wrappers = getTranslationWrappers(tweet)
        expect(wrappers).toHaveLength(translations.length)
        wrappers.forEach((wrapper, index) => {
          expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS, translations[index])
          expect(wrapper.querySelector(`.${INLINE_CONTENT_CLASS}`)).toBeFalsy()
        })
        return wrappers
      }

      const expectTextInDocumentOrder = (tweet: HTMLElement, expected: string[]) => {
        const renderedText = tweet.textContent ?? ""
        let previousIndex = -1
        for (const text of expected) {
          const nextIndex = renderedText.indexOf(text, previousIndex + 1)
          expect(
            nextIndex,
            `Expected ${JSON.stringify(text)} after index ${previousIndex}`,
          ).toBeGreaterThan(previousIndex)
          previousIndex = nextIndex
        }
      }

      afterEach(() => {
        vi.mocked(translateTextForPage).mockReset().mockResolvedValue(MOCK_TRANSLATION)
      })

      it("keeps a simple single-span tweet as one block translation", async () => {
        await withHost("x.com", async () => {
          const sourceText = "Music changes the way we think."
          vi.mocked(translateTextForPage).mockClear()
          render(
            <div data-testid="tweetText">
              <span>{sourceText}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const deepestSpan = tweet.querySelector("span")!

          await removeOrShowPageTranslation("bilingual", true)

          expect(translateTextForPage).toHaveBeenCalledTimes(1)
          expect(translateTextForPage).toHaveBeenCalledWith(sourceText, "plain")
          const wrapper = expectTranslationWrapper(deepestSpan, "bilingual")
          expect(wrapper).toBe(deepestSpan.lastChild)
          expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
          expect(tweet.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)
        })
      })

      it("removes orphan virtual wrappers on toggle without changing source fragments", async () => {
        await withHost("x.com", async () => {
          const sourceText = "First paragraph.\n\nSecond paragraph."
          vi.mocked(translateTextForPage).mockClear()
          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{sourceText}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const sourceSpan = tweet.querySelector("span")!
          const source = sourceSpan.firstChild as Text
          const tail = source.splitText(sourceText.indexOf("\n\n"))
          const orphanWrappers = [0, 1].map((index) => {
            const wrapper = document.createElement("span")
            wrapper.className = `notranslate ${CONTENT_WRAPPER_CLASS}`
            wrapper.setAttribute(VIRTUAL_PARAGRAPH_ATTRIBUTE, `orphan:${index}`)
            wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
            wrapper.textContent = `Old translation ${index + 1}`
            return wrapper
          })
          sourceSpan.insertBefore(orphanWrappers[0], tail)
          sourceSpan.append(orphanWrappers[1])

          await removeOrShowPageTranslation("bilingual", true)

          expect(translateTextForPage).not.toHaveBeenCalled()
          expect(getTranslationWrappers(tweet)).toHaveLength(0)
          expect(sourceSpan.textContent).toBe(sourceText)
          expect(sourceSpan.firstChild).toBe(source)
          expect(source.nextSibling).toBe(tail)
        })
      })

      it("replaces a truncated translation after X expands the same tweetText node", async () => {
        await withHost("x.com", async () => {
          const truncatedRequestText = "I'm a cardiologist.No protein"
          const expandedFirstParagraph = "I'm a cardiologist.\nNo protein and more."
          const hashtagParagraph = "#Football #Soccer"
          const translations = {
            truncated: "【旧的截断译文】",
            expanded: "【展开后的正文译文】",
            hashtags: "【标签译文】",
          }
          vi.mocked(translateTextForPage).mockImplementation(async (text) => {
            if (text === truncatedRequestText) return translations.truncated
            if (text === expandedFirstParagraph) return translations.expanded
            if (text === hashtagParagraph) return translations.hashtags
            throw new Error(`Unexpected paragraph: ${text}`)
          })

          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{"I'm a cardiologist."}</span>
              <span>{"\nNo protein"}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const expandingText = tweet.lastElementChild!.firstChild as Text
          const walkId = "x-show-more-walk"

          walkAndLabelElement(tweet, walkId, BILINGUAL_CONFIG)
          await act(async () => {
            await translateNodesBilingualMode([tweet], walkId, BILINGUAL_CONFIG)
          })
          expectBlockTranslations(tweet, [translations.truncated])

          expandingText.data = "\nNo protein and more.\n\n"
          const football = document.createElement("a")
          football.href = "https://x.com/hashtag/Football"
          football.textContent = "#Football"
          const soccer = document.createElement("a")
          soccer.href = "https://x.com/hashtag/Soccer"
          soccer.textContent = "#Soccer"
          tweet.append(football, " ", soccer)

          walkAndLabelElement(tweet, walkId, BILINGUAL_CONFIG)
          await act(async () => {
            await translateNodesBilingualMode([tweet], walkId, BILINGUAL_CONFIG)
          })

          expect(translateTextForPage).toHaveBeenCalledTimes(3)
          expect(translateTextForPage).toHaveBeenNthCalledWith(1, truncatedRequestText, "plain")
          expect(translateTextForPage).toHaveBeenNthCalledWith(2, expandedFirstParagraph, "plain")
          expect(translateTextForPage).toHaveBeenNthCalledWith(3, hashtagParagraph, "plain")
          expectBlockTranslations(tweet, [translations.expanded, translations.hashtags])
          expect(tweet).not.toHaveTextContent(translations.truncated)
          expectTextInDocumentOrder(tweet, [
            expandedFirstParagraph,
            translations.expanded,
            hashtagParagraph,
            translations.hashtags,
          ])
        })
      })

      it("reconciles virtual split tails when X expands its original Text node", async () => {
        await withHost("x.com", async () => {
          const initialParagraphs = ["Opening paragraph.", "Line one\nLine two", "Only ONE will"]
          const expandedParagraphs = [
            "Opening paragraph.",
            "Line one\nLine two",
            "Only ONE will lift the trophy.",
            "#Football #Soccer",
          ]
          const initialSource = initialParagraphs.join("\n\n")
          const expandedSource = expandedParagraphs.join("\n\n")
          const translationByText = new Map(
            [...new Set([...initialParagraphs, ...expandedParagraphs])].map((text, index) => [
              text,
              `【展开测试译文 ${index + 1}】`,
            ]),
          )
          vi.mocked(translateTextForPage).mockImplementation(async (text) => {
            const translation = translationByText.get(text)
            if (!translation) throw new Error(`Unexpected paragraph: ${text}`)
            return translation
          })

          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{initialSource}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const sourceSpan = tweet.querySelector("span")!
          const originalText = sourceSpan.firstChild as Text
          const walkId = "x-virtual-show-more-walk"

          walkAndLabelElement(tweet, walkId, BILINGUAL_CONFIG)
          await act(async () => {
            await translateNodesBilingualMode([tweet], walkId, BILINGUAL_CONFIG)
          })
          expect(getTranslationWrappers(tweet)).toHaveLength(3)

          originalText.data = expandedSource
          walkAndLabelElement(tweet, walkId, BILINGUAL_CONFIG)
          await act(async () => {
            await translateNodesBilingualMode([tweet], walkId, BILINGUAL_CONFIG)
          })

          expect(getTranslationWrappers(tweet)).toHaveLength(4)
          expect((tweet.textContent?.match(/Only ONE will/g) ?? []).length).toBe(1)
          expectTextInDocumentOrder(
            tweet,
            expandedParagraphs.flatMap((paragraph) => [
              paragraph,
              translationByText.get(paragraph)!,
            ]),
          )

          await act(async () => {
            await translateNodesBilingualMode([tweet], walkId, BILINGUAL_CONFIG, true)
          })
          expect(getTranslationWrappers(tweet)).toHaveLength(0)
          expect(sourceSpan.firstChild).toBe(originalText)
          expect(sourceSpan.textContent).toBe(expandedSource)
        })
      })

      it("interleaves both RBReich paragraphs even when translations resolve out of order", async () => {
        await withHost("x.com", async () => {
          const paragraphs = [
            "Thinking about shopping on Amazon for Cyber Monday?",
            "Watch this first.",
          ]
          const translations = ["【购物译文】", "【观看译文】"]
          let resolveFirst!: (value: string) => void
          let resolveSecond!: (value: string) => void
          const firstTranslation = new Promise<string>((resolve) => {
            resolveFirst = resolve
          })
          const secondTranslation = new Promise<string>((resolve) => {
            resolveSecond = resolve
          })
          vi.mocked(translateTextForPage).mockImplementation((text) => {
            if (text === paragraphs[0]) return firstTranslation
            if (text === paragraphs[1]) return secondTranslation
            throw new Error(`Unexpected paragraph: ${text}`)
          })

          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{paragraphs.join("\n\n")}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")

          const translationPromise = removeOrShowPageTranslation("bilingual", true)
          await waitFor(() => expect(translateTextForPage).toHaveBeenCalledTimes(2))

          resolveSecond(translations[1])
          await Promise.resolve()
          resolveFirst(translations[0])
          await translationPromise

          expect(translateTextForPage).toHaveBeenNthCalledWith(1, paragraphs[0], "plain")
          expect(translateTextForPage).toHaveBeenNthCalledWith(2, paragraphs[1], "plain")
          expectBlockTranslations(tweet, translations)
          expectTextInDocumentOrder(tweet, [
            paragraphs[0],
            translations[0],
            paragraphs[1],
            translations[1],
          ])
        })
      })

      it("keeps pending virtual paragraphs removed when providers settle after cleanup", async () => {
        await withHost("x.com", async () => {
          const paragraphs = ["Pending first paragraph.", "Pending second paragraph."]
          const sourceText = paragraphs.join("\n\n")
          let resolveFirst!: (value: string) => void
          let rejectSecond!: (reason: Error) => void
          const firstTranslation = new Promise<string>((resolve) => {
            resolveFirst = resolve
          })
          const secondTranslation = new Promise<string>((_, reject) => {
            rejectSecond = reject
          })
          vi.mocked(translateTextForPage).mockImplementation((text) => {
            if (text === paragraphs[0]) return firstTranslation
            if (text === paragraphs[1]) return secondTranslation
            throw new Error(`Unexpected paragraph: ${text}`)
          })

          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{sourceText}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const sourceSpan = tweet.querySelector("span")!
          const originalTextNode = sourceSpan.firstChild
          const originalInnerHTML = sourceSpan.innerHTML

          const translationPromise = removeOrShowPageTranslation("bilingual", true)
          await waitFor(() => expect(translateTextForPage).toHaveBeenCalledTimes(2))
          expect(getTranslationWrappers(tweet)).toHaveLength(2)

          await removeOrShowPageTranslation("bilingual", true)

          expect(getTranslationWrappers(tweet)).toHaveLength(0)
          expect(sourceSpan.innerHTML).toBe(originalInnerHTML)
          expect(sourceSpan.firstChild).toBe(originalTextNode)

          resolveFirst("【迟到的第一段译文】")
          rejectSecond(new Error("late provider failure"))
          await translationPromise

          expect(getTranslationWrappers(tweet)).toHaveLength(0)
          expect(tweet.querySelector(`.${TRANSLATION_ERROR_CONTAINER_CLASS}`)).toBeFalsy()
          expect(sourceSpan.innerHTML).toBe(originalInnerHTML)
          expect(sourceSpan.firstChild).toBe(originalTextNode)
        })
      })

      it("drops stale virtual translations when unsplit text and an atomic mention change", async () => {
        await withHost("x.com", async () => {
          let resolveFirst!: (value: string) => void
          let resolveSecond!: (value: string) => void
          vi.mocked(translateTextForPage)
            .mockImplementationOnce(
              () =>
                new Promise<string>((resolve) => {
                  resolveFirst = resolve
                }),
            )
            .mockImplementationOnce(
              () =>
                new Promise<string>((resolve) => {
                  resolveSecond = resolve
                }),
            )

          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{"Welcome "}</span>
              <a href="https://x.com/SohunSanka">@SohunSanka</a>
              <span>{" to the team.\n\nSecond paragraph."}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const prefix = tweet.firstElementChild!
          const prefixText = prefix.firstChild as Text
          const mention = tweet.querySelector("a")!
          const mentionText = mention.firstChild as Text
          const trailing = tweet.lastElementChild!
          const trailingText = trailing.firstChild

          const translationPromise = removeOrShowPageTranslation("bilingual", true)
          await waitFor(() => expect(translateTextForPage).toHaveBeenCalledTimes(2))
          expect(getTranslationWrappers(tweet)).toHaveLength(2)

          prefixText.data = "Host now welcomes "
          mentionText.data = "@UpdatedHandle"
          resolveFirst("【过期第一段】")
          resolveSecond("【过期第二段】")
          await translationPromise

          expect(getTranslationWrappers(tweet)).toHaveLength(0)
          expect(prefix.firstChild).toBe(prefixText)
          expect(prefixText.data).toBe("Host now welcomes ")
          expect(tweet.querySelector("a")).toBe(mention)
          expect(mention.firstChild).toBe(mentionText)
          expect(mentionText.data).toBe("@UpdatedHandle")
          expect(trailing.firstChild).toBe(trailingText)
          expect(tweet).not.toHaveTextContent("【过期")
        })
      })

      it("restores split text after every virtual paragraph translates to its source", async () => {
        await withHost("x.com", async () => {
          const paragraphs = ["Unchanged first paragraph.", "Unchanged second paragraph."]
          const sourceText = paragraphs.join("\n\n")
          vi.mocked(translateTextForPage).mockImplementation(async (text) => text)

          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{sourceText}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const sourceSpan = tweet.querySelector("span")!
          const originalTextNode = sourceSpan.firstChild
          const originalInnerHTML = sourceSpan.innerHTML

          await removeOrShowPageTranslation("bilingual", true)

          expect(translateTextForPage).toHaveBeenCalledTimes(2)
          expect(getTranslationWrappers(tweet)).toHaveLength(0)
          expect(sourceSpan.innerHTML).toBe(originalInnerHTML)
          expect(sourceSpan.firstChild).toBe(originalTextNode)
        })
      })

      it("drops near-echo translations that differ only by cosmetic drift", async () => {
        await withHost("x.com", async () => {
          const paragraphs = ['It\'s a "first" paragraph… REALLY.', "Second paragraph stays."]
          const sourceText = paragraphs.join("\n\n")
          // LLM-style echo: NBSP for spaces, curly quotes, real ellipsis, case drift.
          vi.mocked(translateTextForPage).mockImplementation(async (text) =>
            text
              .replace(/ /g, " ")
              .replace(/'/g, "’")
              .replace(/"/g, "“")
              .replace(/\.\.\./g, "…")
              .toLowerCase(),
          )

          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{sourceText}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const sourceSpan = tweet.querySelector("span")!
          const originalInnerHTML = sourceSpan.innerHTML

          await removeOrShowPageTranslation("bilingual", true)

          expect(translateTextForPage).toHaveBeenCalledTimes(2)
          expect(getTranslationWrappers(tweet)).toHaveLength(0)
          expect(sourceSpan.innerHTML).toBe(originalInnerHTML)
        })
      })

      it("keeps Bora's mention in the first of five interleaved paragraphs", async () => {
        await withHost("x.com", async () => {
          const paragraphs = [
            "Today we are announcing the biggest ACQUISITION of TikTok Shop, sales and marketing human capital in Reacher history... @SohunSanka as our new head of GTM.",
            "It's been a long time coming - from dissing each other in TTS Lark groups.",
            "We eventually decided to quit the shenanigans and put our differences aside.",
            "Filmed a fun video for the announcement - but all fun and games aside time to get to WORK!!!",
            "Let us know if you want any Reacher merch by the way - got a ton to give out!",
          ]
          const translations = paragraphs.map((_, index) => `【Bora 译文 ${index + 1}】`)
          const translationByParagraph = new Map(
            paragraphs.map((paragraph, index) => [paragraph, translations[index]]),
          )
          vi.mocked(translateTextForPage).mockImplementation(async (text) => {
            const translatedText = translationByParagraph.get(text)
            if (!translatedText) throw new Error(`Unexpected paragraph: ${text}`)
            return translatedText
          })

          const mentionPrefix = paragraphs[0].split("@SohunSanka")[0]
          const mentionSuffix = paragraphs[0].split("@SohunSanka")[1]
          const trailingText = `${mentionSuffix}\n\n${paragraphs.slice(1).join("\n\n")}`
          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{mentionPrefix}</span>
              <div className="r-xoduu5" style={{ display: "inline-flex" }}>
                <span style={{ display: "block" }}>
                  <a href="https://x.com/SohunSanka">@SohunSanka</a>
                </span>
              </div>
              <span>{trailingText}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const mention = tweet.querySelector("a")!
          const mentionTextNode = mention.firstChild
          const trailingSourceSpan = tweet.lastElementChild as HTMLElement
          const trailingSourceTextNode = trailingSourceSpan.firstChild
          const originalTrailingInnerHTML = trailingSourceSpan.innerHTML

          await removeOrShowPageTranslation("bilingual", true)

          expect(translateTextForPage).toHaveBeenCalledTimes(5)
          paragraphs.forEach((paragraph, index) => {
            expect(translateTextForPage).toHaveBeenNthCalledWith(index + 1, paragraph, "plain")
          })
          expectBlockTranslations(tweet, translations)
          expectTextInDocumentOrder(
            tweet,
            paragraphs.flatMap((paragraph, index) => [paragraph, translations[index]]),
          )
          expect(tweet.querySelector("a")).toBe(mention)
          expect(mention.firstChild).toBe(mentionTextNode)
          expect(mention).toHaveTextContent("@SohunSanka")
          expect(mention.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()

          await removeOrShowPageTranslation("bilingual", true)

          expect(getTranslationWrappers(tweet)).toHaveLength(0)
          expect(trailingSourceSpan.innerHTML).toBe(originalTrailingInnerHTML)
          expect(tweet.querySelector("a")).toBe(mention)
          expect(mention.firstChild).toBe(mentionTextNode)
          expect(trailingSourceSpan.firstChild).toBe(trailingSourceTextNode)
        })
      })

      it("keeps Boston's score separate from its single-newline hashtag paragraph", async () => {
        await withHost("x.com", async () => {
          const paragraphs = [
            "Rebatida simples do Lowe e corrida anota pelo Yoshida.",
            "BOS 1-0 TOR",
            "#BOSvsTOR #DirtyWater #MLBnaEspn #MLB\n#Redsox",
          ]
          const translations = ["【比赛译文】", "【比分译文】", "【标签译文】"]
          const translationByParagraph = new Map(
            paragraphs.map((paragraph, index) => [paragraph, translations[index]]),
          )
          vi.mocked(translateTextForPage).mockImplementation(async (text) => {
            const translatedText = translationByParagraph.get(text)
            if (!translatedText) throw new Error(`Unexpected paragraph: ${text}`)
            return translatedText
          })

          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{`${paragraphs[0]}\n\n${paragraphs[1]} \n\n`}</span>
              <a href="https://x.com/hashtag/BOSvsTOR">#BOSvsTOR</a>{" "}
              <a href="https://x.com/hashtag/DirtyWater">#DirtyWater</a>{" "}
              <a href="https://x.com/hashtag/MLBnaEspn">#MLBnaEspn</a>{" "}
              <a href="https://x.com/hashtag/MLB">#MLB</a>
              {"\n"}
              <a href="https://x.com/hashtag/Redsox">#Redsox</a>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const hashtags = [...tweet.querySelectorAll("a")]
          const hashtagTextNodes = hashtags.map((hashtag) => hashtag.firstChild)

          await removeOrShowPageTranslation("bilingual", true)

          expect(translateTextForPage).toHaveBeenCalledTimes(3)
          paragraphs.forEach((paragraph, index) => {
            expect(translateTextForPage).toHaveBeenNthCalledWith(index + 1, paragraph, "plain")
          })
          expectBlockTranslations(tweet, translations)
          expectTextInDocumentOrder(
            tweet,
            paragraphs.flatMap((paragraph, index) => [paragraph, translations[index]]),
          )
          hashtags.forEach((hashtag, index) => {
            expect(tweet.querySelectorAll("a")[index]).toBe(hashtag)
            expect(hashtag.firstChild).toBe(hashtagTextNodes[index])
            expect(hashtag.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
          })
        })
      })

      it.each(["normal", "nowrap"] as const)(
        "does not split literal blank lines under white-space: %s",
        async (whiteSpace) => {
          await withHost("x.com", async () => {
            const sourceText = "Source formatting line one.\n\nSource formatting line two."
            vi.mocked(translateTextForPage).mockResolvedValue("【整段译文】")
            render(
              <div data-testid="tweetText" style={{ whiteSpace }}>
                <span>{sourceText}</span>
              </div>,
            )
            const tweet = screen.getByTestId("tweetText")

            await removeOrShowPageTranslation("bilingual", true)

            expect(translateTextForPage).toHaveBeenCalledTimes(1)
            expect(translateTextForPage).toHaveBeenCalledWith(sourceText, "plain")
            expectBlockTranslations(tweet, ["【整段译文】"])
          })
        },
      )

      it("does not split a single preserved newline", async () => {
        await withHost("x.com", async () => {
          const sourceText = "#MLB\n#Redsox"
          vi.mocked(translateTextForPage).mockResolvedValue("【标签整段译文】")
          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{sourceText}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")

          await removeOrShowPageTranslation("bilingual", true)

          expect(translateTextForPage).toHaveBeenCalledTimes(1)
          expect(translateTextForPage).toHaveBeenCalledWith(sourceText, "plain")
          expectBlockTranslations(tweet, ["【标签整段译文】"])
        })
      })

      it("keeps one eligible virtual unit positioned when the other is filtered", async () => {
        await withHost("x.com", async () => {
          const sourceText = "Translate this paragraph.\n\n@OnlyHandle"
          vi.mocked(translateTextForPage).mockResolvedValue("【唯一译文】")
          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{sourceText}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const sourceSpan = tweet.querySelector("span")!
          const originalText = sourceSpan.firstChild

          await removeOrShowPageTranslation("bilingual", true)

          expect(translateTextForPage).toHaveBeenCalledTimes(1)
          expect(translateTextForPage).toHaveBeenCalledWith("Translate this paragraph.", "plain")
          expectBlockTranslations(tweet, ["【唯一译文】"])
          expectTextInDocumentOrder(tweet, [
            "Translate this paragraph.",
            "【唯一译文】",
            "@OnlyHandle",
          ])

          await removeOrShowPageTranslation("bilingual", true)
          expect(getTranslationWrappers(tweet)).toHaveLength(0)
          expect(sourceSpan.firstChild).toBe(originalText)
          expect(sourceSpan.textContent).toBe(sourceText)
        })
      })

      it("leaves no split state when every virtual unit is filtered", async () => {
        await withHost("x.com", async () => {
          const sourceText = "@FirstHandle\n\n@SecondHandle"
          vi.mocked(translateTextForPage).mockClear()
          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{sourceText}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const sourceSpan = tweet.querySelector("span")!
          const originalText = sourceSpan.firstChild

          await removeOrShowPageTranslation("bilingual", true)

          expect(translateTextForPage).not.toHaveBeenCalled()
          expect(getTranslationWrappers(tweet)).toHaveLength(0)
          expect(sourceSpan.firstChild).toBe(originalText)
          expect(sourceSpan.textContent).toBe(sourceText)
        })
      })

      it("removes wrappers without restoring stale text after the host replaces a split source node", async () => {
        await withHost("x.com", async () => {
          const paragraphs = ["Original first paragraph.", "Original second paragraph."]
          vi.mocked(translateTextForPage).mockImplementation(async (text) => `【${text}】`)
          render(
            <div data-testid="tweetText" style={{ whiteSpace: "pre-wrap" }}>
              <span>{paragraphs.join("\n\n")}</span>
            </div>,
          )
          const tweet = screen.getByTestId("tweetText")
          const sourceSpan = tweet.querySelector("span")!

          await removeOrShowPageTranslation("bilingual", true)
          expect(getTranslationWrappers(tweet)).toHaveLength(2)

          const splitSourceNode = sourceSpan.firstChild!
          const hostReplacement = document.createTextNode("Host-updated first paragraph.")
          splitSourceNode.replaceWith(hostReplacement)

          await removeOrShowPageTranslation("bilingual", true)

          expect(getTranslationWrappers(tweet)).toHaveLength(0)
          expect(hostReplacement.isConnected).toBe(true)
          expect(tweet).toHaveTextContent("Host-updated first paragraph.")
          expect(tweet).not.toHaveTextContent(paragraphs[0])
        })
      })
    })

    it("translates each Engoo paragraph once with block layout", async () => {
      await withHost("engoo.com", async () => {
        const nestedText = "Brain resonance shapes how music feels."
        const mixedText = "Shared rhythms connect people."
        vi.mocked(translateTextForPage).mockClear()
        render(
          <article>
            <p data-testid="engoo-nested">
              <span>
                <span>{nestedText}</span>
              </span>
            </p>
            <p data-testid="engoo-mixed">
              <span>{"Shared rhythms "}</span>
              <em>connect</em>
              <span>{" people."}</span>
            </p>
          </article>,
        )
        const nestedParagraph = screen.getByTestId("engoo-nested")
        const mixedParagraph = screen.getByTestId("engoo-mixed")
        const deepestSpan = nestedParagraph.querySelector("span span")!

        await removeOrShowPageTranslation("bilingual", true)

        expect(translateTextForPage).toHaveBeenCalledTimes(2)
        expect(translateTextForPage).toHaveBeenCalledWith(nestedText, "plain")
        expect(translateTextForPage).toHaveBeenCalledWith(mixedText, "plain")

        const nestedWrapper = expectTranslationWrapper(deepestSpan, "bilingual")
        expect(nestedWrapper).toBe(deepestSpan.lastChild)
        expectTranslatedContent(nestedWrapper, BLOCK_CONTENT_CLASS)
        expect(nestedParagraph.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)

        const mixedWrapper = expectTranslationWrapper(mixedParagraph, "bilingual")
        expect(mixedWrapper).toBe(mixedParagraph.lastChild)
        expectTranslatedContent(mixedWrapper, BLOCK_CONTENT_CLASS)
        expect(mixedParagraph.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)
      })
    })

    it("keeps force-inline tag priority when BUTTON is the logical source", async () => {
      render(
        <div data-testid="test-node">
          <button type="button">
            <span>Open translated menu</span>
          </button>
        </div>,
      )
      const node = screen.getByTestId("test-node")
      const button = node.querySelector("button")!
      const deepestSpan = button.querySelector("span")!

      await removeOrShowPageTranslation("bilingual", true)

      const wrapper = expectTranslationWrapper(deepestSpan, "bilingual")
      expect(wrapper).toBe(deepestSpan.lastChild)
      expectTranslatedContent(wrapper, INLINE_CONTENT_CLASS)
      expect(button.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)
    })

    it("keeps force-inline tag priority when a block-styled anchor is the logical source", async () => {
      render(
        <div data-testid="test-node">
          <a href="https://example.com/share" style={{ display: "block" }}>
            <span>Share this page</span>
          </a>
        </div>,
      )
      const node = screen.getByTestId("test-node")
      const anchor = node.querySelector("a")!
      const deepestSpan = anchor.querySelector("span")!

      await removeOrShowPageTranslation("bilingual", true)

      const wrapper = expectTranslationWrapper(deepestSpan, "bilingual")
      expect(wrapper).toBe(deepestSpan.lastChild)
      expectTranslatedContent(wrapper, INLINE_CONTENT_CLASS)
      expect(anchor.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)
    })

    it("keeps display contents as a block logical source after unwrapping", async () => {
      render(
        <div data-testid="test-node">
          <div style={{ display: "contents" }}>
            <span>Contents wrapper text</span>
          </div>
        </div>,
      )
      const node = screen.getByTestId("test-node")
      const contents = node.children[0]
      const deepestSpan = contents.querySelector("span")!

      await removeOrShowPageTranslation("bilingual", true)

      const wrapper = expectTranslationWrapper(deepestSpan, "bilingual")
      expect(wrapper).toBe(deepestSpan.lastChild)
      expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
      expect(contents.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)
    })
  })

  describe("block node with multiple child nodes", () => {
    describe("all inline HTML nodes", () => {
      it("bilingual mode: should insert wrapper after the last inline node", async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[1], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[2], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])

        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })

      it("translation only mode: should replace all inline nodes with single wrapper", async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "translationOnly")
        expect(wrapper).toBe(node.childNodes[0])

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
    })
    describe("inline nodes with aria-hidden block children", () => {
      it("bilingual mode: should treat inline node with aria-hidden block child as inline and translate as one paragraph", async () => {
        // Github issue: https://github.com/mengxi-ream/read-frog/issues/737
        render(
          <div data-testid="test-node">
            <div style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</div>
            <div style={{ display: "inline" }}>
              <div aria-hidden="true" style={{ display: "block" }}></div>
              {MOCK_ORIGINAL_TEXT}
            </div>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[1], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])

        // Should have single translation wrapper at the end (one paragraph)
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      })
    })
    describe("text node and inline HTML nodes", () => {
      it("bilingual mode: should insert wrapper after the last inline node", async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
      it("translation only mode: should replace mixed text and inline nodes with single wrapper", async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "translationOnly")
        expect(wrapper).toBe(node.childNodes[0])

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
    })
    describe("inline nodes + block node + inline nodes", () => {
      it("bilingual mode: should insert three wrappers", async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            <div>{MOCK_ORIGINAL_TEXT}</div>
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper1 = expectTranslationWrapper(node, "bilingual")
        expect(wrapper1).toBe(node.childNodes[2])
        // force translate span as inline even it's block node
        expectTranslatedContent(wrapper1, INLINE_CONTENT_CLASS)
        const wrapper2 = expectTranslationWrapper(node.children[2], "bilingual")
        expect(wrapper2).toBe(node.childNodes[3].childNodes[1])
        expectTranslatedContent(wrapper2, BLOCK_CONTENT_CLASS)
        const wrapper3 = node.lastChild
        expect(wrapper3).toHaveClass(CONTENT_WRAPPER_CLASS)
        expectTranslatedContent(wrapper3 as Element, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
      it("translation only mode: should wrap the mixed inline group and swap block/text runs in place", async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            <div>{MOCK_ORIGINAL_TEXT}</div>
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        // Run [text, span]: mixed inline run cannot be paired against the
        // plain-text translation, so the wrapper fallback keeps applying.
        const wrapper1 = expectTranslationWrapper(node, "translationOnly")
        expect(wrapper1).toBe(node.childNodes[0])
        // Run inside the block <div>: single text node, swapped in place.
        expectInPlaceTranslation(node.children[1])
        // Trailing text run: swapped in place; its anchor is the paragraph.
        expect(node).toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)
        const lastChild = node.lastChild as Text
        expect(lastChild.nodeType).toBe(Node.TEXT_NODE)
        expect(lastChild.data).toBe(MOCK_TRANSLATION)

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.querySelector(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)).toBeFalsy()
        expect(node).not.toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
    })
    describe("floating inline HTML nodes", () => {
      describe("large initial floating letter (float: left + inline next sibling)", () => {
        it("bilingual mode: should treat float left with inline next sibling as large initial letter", async () => {
          render(
            <div data-testid="test-node">
              <span style={{ float: "left" }}>{MOCK_ORIGINAL_TEXT}</span>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            </div>,
          )
          const node = screen.getByTestId("test-node")
          await removeOrShowPageTranslation("bilingual", true)

          expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
          expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
          expectNodeLabels(node.children[1], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
          const wrapper = expectTranslationWrapper(node, "bilingual")
          expect(wrapper).toBe(node.lastChild)
          expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

          await removeOrShowPageTranslation("bilingual", true)
          expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
          expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
        })
        it("translation only mode: should treat float left with inline next sibling as large initial letter", async () => {
          render(
            <div data-testid="test-node">
              <span style={{ float: "left" }}>{MOCK_ORIGINAL_TEXT}</span>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            </div>,
          )
          const node = screen.getByTestId("test-node")
          await removeOrShowPageTranslation("translationOnly", true)

          expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
          const wrapper = expectTranslationWrapper(node, "translationOnly")
          expect(wrapper).toBe(node.childNodes[0])

          await removeOrShowPageTranslation("translationOnly", true)
          expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
          expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
        })
      })
      // Note: jsdom doesn't implement CSS "float blockifies display" rule,
      // so floated <span> elements remain display:inline in jsdom.
      // In real browsers, floated elements would be blockified.
      describe("float: right should NOT be treated as large initial letter", () => {
        it("bilingual mode: float right span remains inline in jsdom (no blockification)", async () => {
          render(
            <div data-testid="test-node">
              <span style={{ float: "right" }}>{MOCK_ORIGINAL_TEXT}</span>
              <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            </div>,
          )
          const node = screen.getByTestId("test-node")
          await removeOrShowPageTranslation("bilingual", true)

          expectNodeLabels(node, [BLOCK_ATTRIBUTE])
          // jsdom returns display:inline for floated spans (no blockification)
          expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
          expectNodeLabels(node.children[1], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        })
      })
      describe("float: left without inline next sibling should NOT be treated as large initial letter", () => {
        it("bilingual mode: float left span without next sibling remains inline in jsdom", async () => {
          render(
            <div data-testid="test-node">
              <span style={{ float: "left" }}>{MOCK_ORIGINAL_TEXT}</span>
            </div>,
          )
          const node = screen.getByTestId("test-node")
          await removeOrShowPageTranslation("bilingual", true)

          expectNodeLabels(node, [BLOCK_ATTRIBUTE])
          // jsdom returns display:inline for floated spans (no blockification)
          expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        })
        it("bilingual mode: float left span with block next sibling remains inline in jsdom", async () => {
          // https://theqoo.net/genrefiction/1771494967
          render(
            <div data-testid="test-node">
              <span style={{ float: "left" }}>{MOCK_ORIGINAL_TEXT}</span>
              <div>{MOCK_ORIGINAL_TEXT}</div>
            </div>,
          )
          const node = screen.getByTestId("test-node")
          await removeOrShowPageTranslation("bilingual", true)

          expectNodeLabels(node, [BLOCK_ATTRIBUTE])
          // jsdom returns display:inline for floated spans (no blockification)
          expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
          expectNodeLabels(node.children[1], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        })
      })
      describe("block translations beside floated siblings", () => {
        it("bilingual mode: marks block translation for float wrap when inline-block would drop below the float", async () => {
          render(
            <div data-testid="test-node">
              <figure data-testid="float-node" style={{ float: "right" }}>
                <span aria-hidden="true" />
              </figure>
              <p data-testid="paragraph">{MOCK_ORIGINAL_TEXT}</p>
            </div>,
          )
          const node = screen.getByTestId("test-node")
          const paragraph = screen.getByTestId("paragraph")
          const floatNode = screen.getByTestId("float-node")

          const rectSpy = vi
            .spyOn(HTMLElement.prototype, "getBoundingClientRect")
            .mockImplementation(function (this: HTMLElement) {
              if (this === floatNode) {
                return createRect({ top: 80, left: 600, width: 200, height: 320 })
              }
              if (this === paragraph) {
                return createRect({ top: 100, left: 0, width: 600, height: 60 })
              }
              if (this.classList.contains(BLOCK_CONTENT_CLASS)) {
                return createRect({ top: 420, left: 0, width: 500, height: 40 })
              }
              return createRect({ top: 0, left: 0, width: 200, height: 20 })
            })

          try {
            await removeOrShowPageTranslation("bilingual", true)
          } finally {
            rectSpy.mockRestore()
          }

          expectNodeLabels(node, [BLOCK_ATTRIBUTE])
          expectNodeLabels(paragraph, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
          const wrapper = expectTranslationWrapper(paragraph, "bilingual")
          const translatedContent = expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
          expect(translatedContent).toHaveAttribute(FLOAT_WRAP_ATTRIBUTE, "true")
        })

        it("bilingual mode: leaves block translation unchanged when the translated node stays beside the float", async () => {
          render(
            <div data-testid="test-node">
              <figure data-testid="float-node" style={{ float: "right" }}>
                <span aria-hidden="true" />
              </figure>
              <p data-testid="paragraph">{MOCK_ORIGINAL_TEXT}</p>
            </div>,
          )
          const paragraph = screen.getByTestId("paragraph")
          const floatNode = screen.getByTestId("float-node")

          const rectSpy = vi
            .spyOn(HTMLElement.prototype, "getBoundingClientRect")
            .mockImplementation(function (this: HTMLElement) {
              if (this === floatNode) {
                return createRect({ top: 80, left: 600, width: 200, height: 320 })
              }
              if (this === paragraph) {
                return createRect({ top: 420, left: 0, width: 600, height: 60 })
              }
              if (this.classList.contains(BLOCK_CONTENT_CLASS)) {
                return createRect({ top: 500, left: 0, width: 500, height: 40 })
              }
              return createRect({ top: 0, left: 0, width: 200, height: 20 })
            })

          try {
            await removeOrShowPageTranslation("bilingual", true)
          } finally {
            rectSpy.mockRestore()
          }

          const wrapper = expectTranslationWrapper(paragraph, "bilingual")
          const translatedContent = expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
          expect(translatedContent).not.toHaveAttribute(FLOAT_WRAP_ATTRIBUTE)
        })
      })
    })
    describe("br dom between inline nodes", () => {
      it("bilingual mode: should insert separate wrappers for paragraphs and be block wrappers", async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <br />
            {MOCK_ORIGINAL_TEXT}
            <br />
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        const wrapper1 = node.children[0]
        expectTranslatedContent(wrapper1, BLOCK_CONTENT_CLASS)
        const wrapper2 = node.children[2]
        expectTranslatedContent(wrapper2, BLOCK_CONTENT_CLASS)
        const wrapper3 = node.children[4]
        expectTranslatedContent(wrapper3, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
      it("bilingual mode: should let br node to make its ancestor node to be forced block node", async () => {
        // Github issue: https://github.com/mengxi-ream/read-frog/issues/587
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span>
              <br />
            </span>
            {MOCK_ORIGINAL_TEXT}
            <span>
              <br />
            </span>
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        const wrapper1 = node.children[0]
        expectTranslatedContent(wrapper1, BLOCK_CONTENT_CLASS)
        const wrapper2 = node.children[2]
        expectTranslatedContent(wrapper2, BLOCK_CONTENT_CLASS)
        const wrapper3 = node.children[4]
        expectTranslatedContent(wrapper3, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
      it("bilingual mode: should insert separate wrappers for inline groups separated by br", async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            <br />
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            {MOCK_ORIGINAL_TEXT}
            <br />
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper1 = expectTranslationWrapper(node.children[0], "bilingual")
        expect(wrapper1).toBe(node.childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper1, INLINE_CONTENT_CLASS)
        expectNodeLabels(node.children[2], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper2 = node.children[3]
        expect(wrapper2).toHaveClass(CONTENT_WRAPPER_CLASS)
        expectTranslatedContent(wrapper2, BLOCK_CONTENT_CLASS)
        expectNodeLabels(node.children[5], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper3 = expectTranslationWrapper(node.children[5], "bilingual")
        expect(wrapper3).toBe(node.children[5].childNodes[1])
        expectTranslatedContent(wrapper3, INLINE_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
      it("translation only mode: should swap single-span groups in place and wrap the mixed group between br", async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            <br />
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            {MOCK_ORIGINAL_TEXT}
            <br />
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        // Run [span]: descends to its single text node, swapped in place.
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectInPlaceTranslation(node.children[0])
        // Run [span, text]: mixed inline run keeps the wrapper fallback.
        const wrapper2 = node.childNodes[2]
        expect(wrapper2).toHaveClass(CONTENT_WRAPPER_CLASS)
        // Run [span]: swapped in place.
        expectInPlaceTranslation(node.children[4])

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.querySelector(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
    })
    describe("inline node has only one block node child", () => {
      // Github issue: https://github.com/mengxi-ream/read-frog/issues/530
      it("bilingual mode: should treat inline node with only one block node child as inline", async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: "inline" }}>
              <div style={{ display: "block" }}>{MOCK_ORIGINAL_TEXT}</div>
            </span>
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[1], [INLINE_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
      it("translation only mode: should replace inline node with only one block node child with single wrapper", async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: "inline" }}>
              <div style={{ display: "block" }}>{MOCK_ORIGINAL_TEXT}</div>
            </span>
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "translationOnly")
        expect(wrapper).toBe(node.childNodes[0])

        await removeOrShowPageTranslation("translationOnly", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
      it("should treat inline element with only one meaningful block child as inline (not block)", async () => {
        // https://github.com/mengxi-ream/read-frog/issues/530
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>
              {/* whitespace nodes should not count as meaningful children */}
              {"\n  "}
              <div style={{ display: "block" }}>{MOCK_ORIGINAL_TEXT}</div>
              {"\n  "}
            </span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        const inlineSpan = node.children[0] as HTMLElement
        await removeOrShowPageTranslation("bilingual", true)

        // The span should be labeled as INLINE, not BLOCK, because it has only one meaningful child
        expectNodeLabels(inlineSpan, [INLINE_ATTRIBUTE])
        expectNodeLabels(inlineSpan.children[0], [BLOCK_ATTRIBUTE])
      })
      it("should translate inside the inline parent using the outer block layout", async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>
              <div style={{ display: "block" }}>{MOCK_ORIGINAL_TEXT}</div>
              {MOCK_ORIGINAL_TEXT}
            </span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [BLOCK_ATTRIBUTE])

        const wrapper = expectTranslationWrapper(node.children[0], "bilingual")
        expect(wrapper).toBe(node.children[0].lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
        expect(node.children[0].querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it("should unwrap through the inline parent into the single block container", async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>
              <div style={{ display: "block" }}>
                <div style={{ display: "block" }}>{MOCK_ORIGINAL_TEXT}</div>
                <div style={{ display: "block" }}>{MOCK_ORIGINAL_TEXT}</div>
                <div style={{ display: "block" }}>{MOCK_ORIGINAL_TEXT}</div>
              </div>
            </span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [BLOCK_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node.children[0].children[0], "bilingual")
        expect(wrapper).toBe(node.children[0].children[0].lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
        expect(
          node.children[0].children[0].querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`),
        ).toHaveLength(1)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
    })
    describe("force inline tags inside paragraphs", () => {
      it("bilingual mode: should not split paragraph when inline tag has only decorative block child", async () => {
        render(
          <p data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <a style={{ display: "inline-flex" }}>
              <span style={{ display: "block" }}></span>
              {MOCK_ORIGINAL_TEXT}
            </a>
            {MOCK_ORIGINAL_TEXT}
          </p>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
        expect(node.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`).length).toBe(1)

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
        )
      })
      it("bilingual mode: should skip ruby annotations without splitting the paragraph", async () => {
        // https://github.com/mengxi-ream/read-frog/pull/1055
        render(
          <p data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <ruby>
              {MOCK_ORIGINAL_TEXT}
              <rp>(</rp>
              <rt>{MOCK_ORIGINAL_TEXT}</rt>
              <rp>)</rp>
            </ruby>
            {MOCK_ORIGINAL_TEXT}
          </p>,
        )
        const node = screen.getByTestId("test-node")
        const ruby = node.children[0] as HTMLElement
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expect(ruby).toHaveAttribute(INLINE_ATTRIBUTE)
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
        expect(node.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`).length).toBe(1)
        expect(ruby.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()

        await removeOrShowPageTranslation("bilingual", true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(
          `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}(${MOCK_ORIGINAL_TEXT})${MOCK_ORIGINAL_TEXT}`,
        )
      })
    })
  })
  describe("don't walk into siblings (SVG, style, etc.)", () => {
    // https://github.com/mengxi-ream/read-frog/issues/754
    it("bilingual mode: should filter ignored siblings and keep the outer block layout", async () => {
      render(
        <div data-testid="test-node">
          <svg viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <style>{`.some-class { color: red; }`}</style>
          <div style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</div>
        </div>,
      )
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("bilingual", true)

      expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      expectNodeLabels(node.children[2], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      const wrapper = expectTranslationWrapper(node.children[2], "bilingual")
      expect(wrapper).toBe(node.children[2].lastChild)
      expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

      await removeOrShowPageTranslation("bilingual", true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toContain(MOCK_ORIGINAL_TEXT)
    })
    it("translation only mode: should filter out SVG and style siblings and swap inline div text in place", async () => {
      render(
        <div data-testid="test-node">
          <svg viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <style>{`.some-class { color: red; }`}</style>
          <div style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</div>
        </div>,
      )
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("translationOnly", true)

      expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      expectNodeLabels(node.children[2], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      expectInPlaceTranslation(node.children[2])

      await removeOrShowPageTranslation("translationOnly", true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.querySelector(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)).toBeFalsy()
      expect(node.textContent).toContain(MOCK_ORIGINAL_TEXT)
    })
  })
  describe("empty nodes in multiple child nodes", () => {
    it("bilingual mode: should ignore the empty sibling and keep the non-empty block layout", async () => {
      // https://github.com/mengxi-ream/read-frog/issues/717
      render(
        <div data-testid="test-node">
          <div>
            <div style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</div>
          </div>
          <div></div>
        </div>,
      )

      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("bilingual", true)

      expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE])
      expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      const wrapper = expectTranslationWrapper(node.children[0].children[0], "bilingual")
      expect(wrapper).toBe(node.children[0].children[0].lastChild)
      expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

      await removeOrShowPageTranslation("bilingual", true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
    })
  })
  describe("empty text nodes with only one inline node in middle", () => {
    it("bilingual mode: should insert a block translation inside the only inline node", async () => {
      render(
        <div data-testid="test-node">
          {" "}
          <div style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</div>
          {"\n "}
        </div>,
      )
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("bilingual", true)

      expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      const wrapper = expectTranslationWrapper(node.children[0], "bilingual")
      expect(wrapper).toBe(node.children[0].lastChild)
      expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

      await removeOrShowPageTranslation("bilingual", true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(` ${MOCK_ORIGINAL_TEXT}\n `)
    })
    it("translation only mode: should swap text in place inside the inline node", async () => {
      render(
        <div data-testid="test-node">
          {" "}
          <div style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</div>
          {"\n "}
        </div>,
      )
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("translationOnly", true)

      expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      expectInPlaceTranslation(node.children[0])

      await removeOrShowPageTranslation("translationOnly", true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.querySelector(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)).toBeFalsy()
      expect(node.textContent).toBe(` ${MOCK_ORIGINAL_TEXT}\n `)
    })
  })
  describe('empty text nodes with "no need to translate" node in middle', () => {
    it("bilingual mode: should not insert translation wrapper", async () => {
      render(
        <div data-testid="test-node">
          {" "}
          <div>{MOCK_TRANSLATION}</div>{" "}
        </div>,
      )
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("bilingual", true)

      // test no translation wrapper
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(` ${MOCK_TRANSLATION} `)

      await removeOrShowPageTranslation("bilingual", true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(` ${MOCK_TRANSLATION} `)
    })
    it("translation only mode: should swap provider HTML as plain text in place", async () => {
      // Mock translateTextForPage to return structural HTML around the text
      const TRANSLATED_TEXT = `<div>${MOCK_TRANSLATION}</div>`
      vi.mocked(translateTextForPage).mockResolvedValueOnce(TRANSLATED_TEXT)

      render(
        <div data-testid="test-node">
          <div>{MOCK_TRANSLATION}</div>
        </div>,
      )
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("translationOnly", true)

      // Single-text-node run: the provider's hallucinated <div> is flattened
      // to plain text and swapped into the site's own text node.
      const anchor = node.children[0]
      expectInPlaceTranslation(anchor)
      expect(anchor.children).toHaveLength(0)

      await removeOrShowPageTranslation("translationOnly", true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.querySelector(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)).toBeFalsy()
      expect(node.textContent).toBe(MOCK_TRANSLATION)
    })
  })
  describe("switching between translation modes", () => {
    it("should properly clean up translations when switching from bilingual to translation-only mode", async () => {
      render(<div data-testid="test-node">{MOCK_ORIGINAL_TEXT}</div>)
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("bilingual", true)
      await removeOrShowPageTranslation("translationOnly", true)

      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
    })
    it("should properly clean up translations when switching from translation-only to bilingual mode", async () => {
      render(<div data-testid="test-node">{MOCK_ORIGINAL_TEXT}</div>)
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("translationOnly", true)
      expectInPlaceTranslation(node)

      // An in-place swap leaves no wrapper for the bilingual walk to detect,
      // so a real mode switch restarts page translation and its stop step
      // (PageTranslationManager.stopInternal) restores the swapped text via
      // removeAllTranslatedWrapperNodes before the next walk starts.
      removeAllTranslatedWrapperNodes()
      expect(node).not.toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)
      expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)

      await removeOrShowPageTranslation("bilingual", true)
      const wrapper = expectTranslationWrapper(node, "bilingual")
      expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

      await removeOrShowPageTranslation("bilingual", true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
    })
  })

  describe("translation errors", () => {
    it("bilingual mode: should keep original text and show inline error UI when translation fails", async () => {
      vi.mocked(translateTextForPage).mockRejectedValueOnce(new Error("Translation failed"))

      render(<div data-testid="test-node">{MOCK_ORIGINAL_TEXT}</div>)
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("bilingual", true)

      const wrapper = expectTranslationWrapper(node, "bilingual")
      expect(node.textContent).toContain(MOCK_ORIGINAL_TEXT)
      await waitForTranslationError(wrapper)
    })

    it("translationOnly mode: should keep original text and show inline error UI when translation fails", async () => {
      vi.mocked(translateTextForPage).mockRejectedValueOnce(new Error("Translation failed"))

      render(<div data-testid="test-node">{MOCK_ORIGINAL_TEXT}</div>)
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("translationOnly", true)

      const wrapper = expectTranslationWrapper(node, "translationOnly")
      expect(node.textContent).toContain(MOCK_ORIGINAL_TEXT)
      await waitForTranslationError(wrapper)
    })

    it("translationOnly mode: should still remove the wrapper when translation returns an empty string", async () => {
      vi.mocked(translateTextForPage).mockResolvedValueOnce("")

      render(<div data-testid="test-node">{MOCK_ORIGINAL_TEXT}</div>)
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("translationOnly", true)

      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
    })
  })

  describe("translationOnly HTML attribute placeholders", () => {
    beforeEach(() => {
      vi.mocked(translateTextForPage).mockReset().mockResolvedValue(MOCK_TRANSLATION)
    })

    afterEach(() => {
      vi.mocked(translateTextForPage).mockReset().mockResolvedValue(MOCK_TRANSLATION)
    })

    it("keeps bilingual translation on the existing plain-text path", async () => {
      render(
        <div data-testid="bilingual-node">
          Hello <strong className="long framework classes">world</strong>.
        </div>,
      )

      await removeOrShowPageTranslation("bilingual", true)

      expect(translateTextForPage).toHaveBeenCalled()
      expect(
        vi
          .mocked(translateTextForPage)
          .mock.calls.every(
            ([request, textFormat]) => !request.includes("data-rf-attr") && textFormat === "plain",
          ),
      ).toBe(true)
    })

    it("sends a compact HTML skeleton and swaps translated text into the untouched source elements", async () => {
      const longClassName = `place ${"utility-class-".repeat(40)}`
      vi.mocked(translateTextForPage).mockImplementation(async (text) => {
        if (text.includes("data-rf-attr")) {
          return `这个星期一我去了<strong data-rf-attr="0" title="城市" onclick="evil()">温哥华</strong>。`
        }
        return MOCK_TRANSLATION
      })

      render(
        <div data-testid="test-node">
          I went to
          <strong className={longClassName} style={{ color: "red" }} data-place="yvr" title="City">
            Vancouver
          </strong>
          this Monday.
        </div>,
      )
      const node = screen.getByTestId("test-node")
      const originalStrong = node.querySelector("strong")

      await removeOrShowPageTranslation("translationOnly", true)

      expect(translateTextForPage).toHaveBeenCalledOnce()
      const [requestHtml, textFormat] = vi.mocked(translateTextForPage).mock.calls[0]
      expect(textFormat).toBe("html")
      expect(requestHtml).toContain(`<strong title="City" data-rf-attr="0">`)
      expect(requestHtml).not.toContain(longClassName)
      expect(requestHtml).not.toContain("data-place")

      // The structural response pairs 1:1 with the source run, so the text is
      // swapped into the site's own text nodes: no wrapper, and the original
      // <strong> element object stays in place with structural attributes
      // untouched. Human-visible attributes the provider translated (title)
      // are swapped alongside the text and restored with the same guard.
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node).toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)
      const translatedStrong = node.querySelector("strong")
      expect(translatedStrong).toBe(originalStrong)
      expect(translatedStrong?.className).toBe(longClassName)
      expect(translatedStrong?.style.color).toBe("red")
      expect(translatedStrong?.getAttribute("data-place")).toBe("yvr")
      expect(translatedStrong?.getAttribute("title")).toBe("城市")
      expect(translatedStrong?.hasAttribute("data-rf-attr")).toBe(false)
      expect(translatedStrong?.hasAttribute("onclick")).toBe(false)
      expect(translatedStrong?.textContent).toBe("温哥华")
      expect(node.textContent).toBe("这个星期一我去了温哥华。")

      await removeOrShowPageTranslation("translationOnly", true)
      expect(node).not.toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)
      const restoredStrong = node.querySelector("strong")
      expect(restoredStrong).toBe(originalStrong)
      expect(restoredStrong?.className).toBe(longClassName)
      expect(restoredStrong?.getAttribute("data-place")).toBe("yvr")
      expect(restoredStrong?.getAttribute("title")).toBe("City")
      expect(restoredStrong?.textContent).toBe("Vancouver")
    })

    it("keeps the original DOM when only restored attribute order differs", async () => {
      vi.mocked(translateTextForPage).mockImplementation(async (request) => request)
      render(
        <div data-testid="same-html-node">
          <strong className="place" title="City" data-place="yvr">
            Vancouver
          </strong>
        </div>,
      )
      const node = screen.getByTestId("same-html-node")
      const originalStrong = node.querySelector("strong")

      await removeOrShowPageTranslation("translationOnly", true)

      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.querySelector("strong")).toBe(originalStrong)
    })

    it("retries the canonical full HTML once when a marker contract is corrupted", async () => {
      vi.mocked(translateTextForPage)
        .mockResolvedValueOnce(`<strong>损坏的 marker</strong>`)
        .mockResolvedValueOnce("完整 HTML 回退译文")

      render(
        <div data-testid="test-node">
          I visited{" "}
          <strong className="place" data-place="yvr">
            Vancouver
          </strong>
          .
        </div>,
      )
      const node = screen.getByTestId("test-node")

      await removeOrShowPageTranslation("translationOnly", true)

      expect(translateTextForPage).toHaveBeenCalledTimes(2)
      expect(vi.mocked(translateTextForPage).mock.calls[0][0]).toContain(`data-rf-attr="0"`)
      expect(vi.mocked(translateTextForPage).mock.calls[0][0]).not.toContain(`class="place"`)
      expect(vi.mocked(translateTextForPage).mock.calls[1][0]).toContain(`class="place"`)
      expect(vi.mocked(translateTextForPage).mock.calls[1][0]).not.toContain("data-rf-attr")
      expect(expectTranslationWrapper(node, "translationOnly")?.textContent).toBe(
        "完整 HTML 回退译文",
      )
    })

    it("escapes and restores a page-owned numeric marker during full HTML fallback", async () => {
      vi.mocked(translateTextForPage)
        .mockResolvedValueOnce(`<strong>损坏的 marker</strong>`)
        .mockResolvedValueOnce(`<strong class="place" data-rf-attr="rf-page-0">温哥华</strong>`)

      render(
        <div data-testid="test-node">
          I visited{" "}
          <strong className="place" data-rf-attr="0">
            Vancouver
          </strong>
          .
        </div>,
      )
      const node = screen.getByTestId("test-node")

      await removeOrShowPageTranslation("translationOnly", true)

      expect(translateTextForPage).toHaveBeenCalledTimes(2)
      expect(vi.mocked(translateTextForPage).mock.calls[1][0]).toContain(`data-rf-attr="rf-page-0"`)
      const translatedStrong = expectTranslationWrapper(node, "translationOnly")?.querySelector(
        "strong",
      )
      expect(translatedStrong?.getAttribute("data-rf-attr")).toBe("0")
      expect(translatedStrong?.className).toBe("place")
    })

    it("keeps the source DOM and existing error UI when the full HTML fallback fails", async () => {
      vi.mocked(translateTextForPage)
        .mockResolvedValueOnce(`<strong>损坏的 marker</strong>`)
        .mockRejectedValueOnce(new Error("Fallback failed"))

      render(
        <div data-testid="test-node">
          I visited <strong className="place">Vancouver</strong>.
        </div>,
      )
      const node = screen.getByTestId("test-node")

      await removeOrShowPageTranslation("translationOnly", true)

      expect(translateTextForPage).toHaveBeenCalledTimes(2)
      const wrapper = expectTranslationWrapper(node, "translationOnly")
      expect(node.textContent).toContain("I visited Vancouver.")
      await waitForTranslationError(wrapper)
    })

    it("disables placeholders for the current DeepLX endpoint after its first integrity failure", async () => {
      const deeplxConfig: Config = {
        ...TRANSLATION_ONLY_CONFIG,
        providersConfig: [
          ...TRANSLATION_ONLY_CONFIG.providersConfig,
          {
            id: "deeplx-default",
            name: "DeepLX",
            enabled: true,
            provider: "deeplx",
            baseURL: "https://deeplx.example/translate",
          },
        ],
        translate: {
          ...TRANSLATION_ONLY_CONFIG.translate,
          providerId: "deeplx-default",
        },
      }
      vi.mocked(translateTextForPage)
        .mockResolvedValueOnce(`<strong>损坏的 marker</strong>`)
        .mockResolvedValueOnce("第一次完整 HTML 回退")
        .mockResolvedValueOnce("第二次直接使用完整 HTML")

      const firstRender = render(
        <div data-testid="first-node">
          First <strong className="place">Vancouver</strong>.
        </div>,
      )
      await removeOrShowPageTranslation("translationOnly", true, deeplxConfig)
      firstRender.unmount()

      render(
        <div data-testid="second-node">
          Second <strong className="place">Vancouver</strong>.
        </div>,
      )
      await removeOrShowPageTranslation("translationOnly", true, deeplxConfig)

      expect(translateTextForPage).toHaveBeenCalledTimes(3)
      expect(vi.mocked(translateTextForPage).mock.calls[0][0]).toContain("data-rf-attr")
      expect(vi.mocked(translateTextForPage).mock.calls[1][0]).not.toContain("data-rf-attr")
      expect(vi.mocked(translateTextForPage).mock.calls[2][0]).not.toContain("data-rf-attr")
      expect(vi.mocked(translateTextForPage).mock.calls[2][0]).toContain(`class="place"`)
    })

    it("shares the first DeepLX capability probe across concurrent paragraphs", async () => {
      const deeplxConfig: Config = {
        ...TRANSLATION_ONLY_CONFIG,
        providersConfig: [
          ...TRANSLATION_ONLY_CONFIG.providersConfig,
          {
            id: "deeplx-concurrent",
            name: "DeepLX Concurrent",
            enabled: true,
            provider: "deeplx",
            baseURL: "https://deeplx-concurrent.example/translate",
          },
        ],
        translate: {
          ...TRANSLATION_ONLY_CONFIG.translate,
          providerId: "deeplx-concurrent",
        },
      }
      let resolveProbe!: (value: string) => void
      const probeResult = new Promise<string>((resolve) => {
        resolveProbe = resolve
      })
      vi.mocked(translateTextForPage)
        .mockImplementationOnce(() => probeResult)
        .mockResolvedValueOnce("第一段完整 HTML 回退")
        .mockResolvedValueOnce("第二段直接使用完整 HTML")

      render(
        <>
          <div data-testid="first-concurrent-node">
            First <strong className="first-place">Vancouver</strong>.
          </div>
          <div data-testid="second-concurrent-node">
            Second <strong className="second-place">Victoria</strong>.
          </div>
        </>,
      )
      const firstNode = screen.getByTestId("first-concurrent-node")
      const secondNode = screen.getByTestId("second-concurrent-node")
      const translations = Promise.all([
        translateNodeTranslationOnlyMode(
          [...firstNode.childNodes],
          "concurrent-walk",
          deeplxConfig,
        ),
        translateNodeTranslationOnlyMode(
          [...secondNode.childNodes],
          "concurrent-walk",
          deeplxConfig,
        ),
      ])

      await waitFor(() => expect(translateTextForPage).toHaveBeenCalledTimes(1))
      resolveProbe(`<strong>损坏的 marker</strong>`)
      await act(async () => {
        await translations
        flushBatchedOperations()
      })

      expect(translateTextForPage).toHaveBeenCalledTimes(3)
      expect(vi.mocked(translateTextForPage).mock.calls[0][0]).toContain("data-rf-attr")
      const fallbackRequests = vi.mocked(translateTextForPage).mock.calls.slice(1)
      expect(fallbackRequests.every(([request]) => !request.includes("data-rf-attr"))).toBe(true)
      expect(fallbackRequests.some(([request]) => request.includes(`class="first-place"`))).toBe(
        true,
      )
      expect(fallbackRequests.some(([request]) => request.includes(`class="second-place"`))).toBe(
        true,
      )
    })

    it("hands an inconclusive empty DeepLX probe to one waiter at a time", async () => {
      const deeplxConfig: Config = {
        ...TRANSLATION_ONLY_CONFIG,
        providersConfig: [
          ...TRANSLATION_ONLY_CONFIG.providersConfig,
          {
            id: "deeplx-empty-probe",
            name: "DeepLX Empty Probe",
            enabled: true,
            provider: "deeplx",
            baseURL: "https://deeplx-empty-probe.example/translate",
          },
        ],
        translate: {
          ...TRANSLATION_ONLY_CONFIG.translate,
          providerId: "deeplx-empty-probe",
        },
      }
      let compactRequestCount = 0
      vi.mocked(translateTextForPage).mockImplementation(async (request) => {
        if (request.includes("data-rf-attr")) {
          compactRequestCount += 1
          return compactRequestCount === 1 ? "" : `<strong>损坏的 marker</strong>`
        }
        return "完整 HTML 回退"
      })

      render(
        <>
          <div data-testid="empty-probe-one">
            One <strong className="one">Vancouver</strong>.
          </div>
          <div data-testid="empty-probe-two">
            Two <strong className="two">Victoria</strong>.
          </div>
          <div data-testid="empty-probe-three">
            Three <strong className="three">Burnaby</strong>.
          </div>
        </>,
      )
      const nodes = [
        screen.getByTestId("empty-probe-one"),
        screen.getByTestId("empty-probe-two"),
        screen.getByTestId("empty-probe-three"),
      ]

      await act(async () => {
        await Promise.all(
          nodes.map((node) =>
            translateNodeTranslationOnlyMode(
              [...node.childNodes],
              "empty-probe-walk",
              deeplxConfig,
            ),
          ),
        )
        flushBatchedOperations()
      })

      const requests = vi.mocked(translateTextForPage).mock.calls.map(([request]) => request)
      expect(requests.filter((request) => request.includes("data-rf-attr"))).toHaveLength(2)
      expect(requests.filter((request) => !request.includes("data-rf-attr"))).toHaveLength(2)
    })
  })

  describe("pre and code tag handling", () => {
    describe("pre tag - should not translate content inside pre", () => {
      it("bilingual mode: should not translate content inside pre tag", async () => {
        render(
          <div data-testid="test-node">
            <pre>{MOCK_ORIGINAL_TEXT}</pre>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        // Should not have any translation wrapper
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })

      it("translation only mode: should not translate content inside pre tag", async () => {
        render(
          <div data-testid="test-node">
            <pre>{MOCK_ORIGINAL_TEXT}</pre>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        // Should not have any translation wrapper
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })

      it("bilingual mode: should not translate pre with multiple lines", async () => {
        const codeContent = `function test() {
  return "hello"
}`
        render(
          <div data-testid="test-node">
            <pre>{codeContent}</pre>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(codeContent)
      })
    })

    describe("github diff table - should not translate review code snippets", () => {
      it("bilingual mode: should keep github release attribution in translation source", async () => {
        const originalLocation = window.location
        setHost("github.com")
        vi.mocked(translateTextForPage).mockClear()

        try {
          render(
            <div data-testid="test-node" className="markdown-body">
              <ul>
                <li>
                  {"perf(main): drop localhost label routes when a worktree is removed by "}
                  <a
                    className="user-mention notranslate"
                    data-hovercard-type="user"
                    href="/taiiiyang"
                  >
                    @taiiiyang
                  </a>
                  {" in "}
                  <a
                    className="issue-link js-issue-link"
                    data-hovercard-type="pull_request"
                    href="/stablyai/orca/pull/7557"
                  >
                    #7557
                  </a>
                </li>
              </ul>
            </div>,
          )

          await removeOrShowPageTranslation("bilingual", true)

          expect(translateTextForPage).toHaveBeenCalledWith(
            "perf(main): drop localhost label routes when a worktree is removed by @taiiiyang in #7557",
            "plain",
          )
          expect(document.querySelector(".user-mention")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(
            false,
          )
          expect(document.querySelector(".issue-link")!.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(
            false,
          )
        } finally {
          Object.defineProperty(window, "location", {
            value: originalLocation,
            writable: true,
            configurable: true,
          })
        }
      })

      it("bilingual mode: should keep classless PR reference links in release notes source", async () => {
        // Modern GitHub release markup renders PR references as a bare
        // `a[data-hovercard-type='pull_request']` with no `.issue-link` class,
        // so the old preserveText rule no longer matched and the broad
        // `a[data-hovercard-type]` exclude dropped "#1837" from the source
        // (issue: PR numbers missing from release-notes translations).
        const originalLocation = window.location
        setHost("github.com")
        vi.mocked(translateTextForPage).mockClear()

        try {
          render(
            <div data-testid="test-node" className="markdown-body">
              <ul>
                <li>
                  <a
                    data-hovercard-type="pull_request"
                    data-hovercard-url="/mengxi-ream/read-frog/pull/1837/hovercard"
                    href="/mengxi-ream/read-frog/pull/1837"
                  >
                    #1837
                  </a>
                  {" feat(translate): return a NO_TRANSLATION_NEEDED sentinel"}
                </li>
              </ul>
            </div>,
          )

          await removeOrShowPageTranslation("bilingual", true)

          expect(translateTextForPage).toHaveBeenCalledWith(
            "#1837 feat(translate): return a NO_TRANSLATION_NEEDED sentinel",
            "plain",
          )
          // Preserved as source text, not promoted to its own paragraph/walked node.
          const prLink = document.querySelector("a[data-hovercard-type='pull_request']")!
          expect(prLink.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
          expect(prLink.hasAttribute(WALKED_ATTRIBUTE)).toBe(false)
        } finally {
          Object.defineProperty(window, "location", {
            value: originalLocation,
            writable: true,
            configurable: true,
          })
        }
      })

      it("bilingual mode: should skip github diff-table content entirely", async () => {
        const originalLocation = window.location
        setHost("github.com")
        vi.mocked(translateTextForPage).mockClear()

        try {
          render(
            <div data-testid="test-node">
              <table className="diff-table">
                <tbody>
                  <tr>
                    <td>const foo = 1</td>
                  </tr>
                </tbody>
              </table>
            </div>,
          )
          const node = screen.getByTestId("test-node")
          await removeOrShowPageTranslation("bilingual", true)

          expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
          expect(node.textContent).toBe("const foo = 1")
          expect(translateTextForPage).not.toHaveBeenCalled()
        } finally {
          Object.defineProperty(window, "location", {
            value: originalLocation,
            writable: true,
            configurable: true,
          })
        }
      })
    })

    describe("code tag - should not walk into but translate as child", () => {
      it("bilingual mode: should translate text with code elements", async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <code>{MOCK_ORIGINAL_TEXT}</code>
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expect(wrapper).toBe(node.lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
      })

      it("translation only mode: should translate text with code elements", async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <code>{MOCK_ORIGINAL_TEXT}</code>
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, "translationOnly")
        expect(wrapper).toBe(node.children[0])
      })
    })
  })

  describe("numeric content handling", () => {
    describe("bilingual mode", () => {
      it("should not translate pure numbers", async () => {
        render(<div data-testid="test-node">12345</div>)
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        // Should not have any translation wrapper
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe("12345")
      })

      it("should not translate numbers with thousand separators", async () => {
        render(<div data-testid="test-node">1,234,567</div>)
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe("1,234,567")
      })

      it("should not translate decimal numbers", async () => {
        render(<div data-testid="test-node">3.14159</div>)
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe("3.14159")
      })

      it("should translate text with numbers mixed in", async () => {
        render(<div data-testid="test-node">原文 123 文字</div>)
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        // Should have translation wrapper since it contains text
        const wrapper = expectTranslationWrapper(node, "bilingual")
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
      })
    })

    describe("translation only mode", () => {
      it("should not translate pure numbers", async () => {
        render(<div data-testid="test-node">67890</div>)
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        // Should not have any translation wrapper
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe("67890")
      })

      it("should not translate numbers with spaces", async () => {
        render(<div data-testid="test-node">1 234 567</div>)
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe("1 234 567")
      })

      it("should not translate European format numbers", async () => {
        render(<div data-testid="test-node">1.234,56</div>)
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe("1.234,56")
      })

      it("should translate text with numbers", async () => {
        render(<div data-testid="test-node">原文包含数字 999</div>)
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        // Should be translated (swapped in place) since it contains text
        expectInPlaceTranslation(node)
        expect(node.textContent).toBe(MOCK_TRANSLATION)
      })
    })

    describe("numeric content with multiple nodes", () => {
      it("bilingual mode: should not translate when all nodes contain only numbers", async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>123</span>
            <span style={{ display: "inline" }}>456</span>
            <span style={{ display: "inline" }}>789</span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe("123456789")
      })

      it("translation only mode: should not translate when all nodes contain only numbers", async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>100</span>
            <span style={{ display: "inline" }}>200</span>
            <span style={{ display: "inline" }}>300</span>
          </div>,
        )
        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("translationOnly", true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe("100200300")
      })
    })
  })
  describe("force block node", () => {
    describe("force <li> as block node", () => {
      it("should treat <li> as block node", async () => {
        render(
          <div data-testid="test-node">
            <li style={{ float: "left" }}>{MOCK_ORIGINAL_TEXT}</li>
            <li style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</li>
          </div>,
        )

        const node = screen.getByTestId("test-node")
        await removeOrShowPageTranslation("bilingual", true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[1], [BLOCK_ATTRIBUTE])
      })
    })
  })
  describe("flex parent", () => {
    it("flex parent: should force the translation style to be inline", async () => {
      render(
        <div data-testid="test-node">
          <div style={{ display: "flex" }}>{MOCK_ORIGINAL_TEXT}</div>
        </div>,
      )
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("bilingual", true)

      expectNodeLabels(node, [BLOCK_ATTRIBUTE])
      expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      const wrapper = expectTranslationWrapper(node.children[0], "bilingual")
      expect(wrapper).toBe(node.children[0].lastChild)
      expectTranslatedContent(wrapper, INLINE_CONTENT_CLASS)

      await removeOrShowPageTranslation("bilingual", true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
    })
    it("flex parent: should translate the inline children to be inline style even have block children", async () => {
      render(
        <div data-testid="test-node">
          <div style={{ display: "flex" }}>
            {MOCK_ORIGINAL_TEXT}
            <div>{MOCK_ORIGINAL_TEXT}</div>
            {MOCK_ORIGINAL_TEXT}
          </div>
        </div>,
      )
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("bilingual", true)

      expectNodeLabels(node, [BLOCK_ATTRIBUTE])
      expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      // First inline group wrapper (text node before block div)
      const wrapper1 = node.children[0].childNodes[1]
      expect(wrapper1).toHaveClass(CONTENT_WRAPPER_CLASS)
      expectTranslatedContent(wrapper1 as Element, INLINE_CONTENT_CLASS)
      // Block child should have its own wrapper
      expectNodeLabels(node.children[0].children[1], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      const wrapper2 = expectTranslationWrapper(node.children[0].children[1], "bilingual")
      expect(wrapper2).toBe(node.children[0].children[1].lastChild)
      expectTranslatedContent(wrapper2, BLOCK_CONTENT_CLASS)
      // Second inline group wrapper (text node after block div)
      const wrapper3 = node.children[0].lastChild
      expect(wrapper3).toHaveClass(CONTENT_WRAPPER_CLASS)
      expectTranslatedContent(wrapper3 as Element, INLINE_CONTENT_CLASS)

      await removeOrShowPageTranslation("bilingual", true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(
        `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
      )
    })
    it("block wrapper: should unwrap into an inline-flex child but keep block layout", async () => {
      render(
        <div data-testid="test-node">
          <div style={{ display: "inline-flex" }}>
            {MOCK_ORIGINAL_TEXT}
            <div>{MOCK_ORIGINAL_TEXT}</div>
            {MOCK_ORIGINAL_TEXT}
          </div>
        </div>,
      )
      const node = screen.getByTestId("test-node")
      await removeOrShowPageTranslation("bilingual", true)

      expectNodeLabels(node, [BLOCK_ATTRIBUTE])
      expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      expectNodeLabels(node.children[0].children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      const wrapper = expectTranslationWrapper(node.children[0], "bilingual")
      expect(wrapper).toBe(node.children[0].lastChild)
      expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
      expect(node.children[0].querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)

      await removeOrShowPageTranslation("bilingual", true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(
        `${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`,
      )
    })
  })

  describe("whitespace and newline handling", () => {
    describe("inline elements separated by newline-only whitespace", () => {
      it("bilingual mode: should preserve word separation when separated by newlines", async () => {
        vi.mocked(translateTextForPage).mockClear()
        // When inline elements are separated by newline-only whitespace,
        // whitespace-only nodes still return single space to preserve word separation
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            {"\n"}
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        await removeOrShowPageTranslation("bilingual", true)

        // Whitespace-only nodes return single space for word separation
        expect(translateTextForPage).toHaveBeenCalledWith(
          `${MOCK_ORIGINAL_TEXT} ${MOCK_ORIGINAL_TEXT}`,
          "plain",
        )
      })
    })

    describe("inline elements has space in between", () => {
      it("bilingual mode: should preserve word separation when separated by newlines", async () => {
        vi.mocked(translateTextForPage).mockClear()
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            <span style={{ display: "inline" }}>{` ${MOCK_ORIGINAL_TEXT}`}</span>
          </div>,
        )
        await removeOrShowPageTranslation("bilingual", true)

        expect(translateTextForPage).toHaveBeenCalledWith(
          `${MOCK_ORIGINAL_TEXT} ${MOCK_ORIGINAL_TEXT}`,
          "plain",
        )
      })
    })

    describe("text node with newline-only vs space leading/trailing whitespace", () => {
      it("bilingual mode: newline-only leading/trailing should not add inner spaces", async () => {
        vi.mocked(translateTextForPage).mockClear()
        // Text like "\nHello\n" - the newlines are trimmed without adding spaces
        // Final text is trimmed before translation anyway
        render(<div data-testid="test-node">{`\n${MOCK_ORIGINAL_TEXT} \n`}</div>)
        await removeOrShowPageTranslation("bilingual", true)

        expect(translateTextForPage).toHaveBeenCalledWith(MOCK_ORIGINAL_TEXT, "plain")
      })

      it("bilingual mode: space leading/trailing is trimmed before translation", async () => {
        vi.mocked(translateTextForPage).mockClear()
        // Text like " Hello " - extracted with spaces, then trimmed before translation
        render(<div data-testid="test-node">{` ${MOCK_ORIGINAL_TEXT} `}</div>)
        await removeOrShowPageTranslation("bilingual", true)

        // Final text is trimmed before translation
        expect(translateTextForPage).toHaveBeenCalledWith(MOCK_ORIGINAL_TEXT, "plain")
      })
    })

    describe("multiple inline elements with different whitespace separators", () => {
      it("bilingual mode: whitespace-only nodes between elements preserve word separation", async () => {
        vi.mocked(translateTextForPage).mockClear()
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
            {"\n\n"}
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        await removeOrShowPageTranslation("bilingual", true)

        // Whitespace-only node returns single space to preserve word separation
        expect(translateTextForPage).toHaveBeenCalledWith(
          `${MOCK_ORIGINAL_TEXT} ${MOCK_ORIGINAL_TEXT}`,
          "plain",
        )
      })

      it("bilingual mode: space-separated inline elements", async () => {
        vi.mocked(translateTextForPage).mockClear()
        render(
          <div data-testid="test-node">
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>{" "}
            <span style={{ display: "inline" }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        await removeOrShowPageTranslation("bilingual", true)

        expect(translateTextForPage).toHaveBeenCalledWith(
          `${MOCK_ORIGINAL_TEXT} ${MOCK_ORIGINAL_TEXT}`,
          "plain",
        )
      })
    })

    describe("br elements in content", () => {
      it("bilingual mode: should handle BR elements as paragraph separators", async () => {
        vi.mocked(translateTextForPage).mockClear()
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <br />
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        await removeOrShowPageTranslation("bilingual", true)

        // BR elements are handled as paragraph separators, each paragraph translated separately
        expect(translateTextForPage).toHaveBeenCalledTimes(2)
        expect(translateTextForPage).toHaveBeenNthCalledWith(1, MOCK_ORIGINAL_TEXT, "plain")
        expect(translateTextForPage).toHaveBeenNthCalledWith(2, MOCK_ORIGINAL_TEXT, "plain")
      })

      it("translationOnly mode: should handle BR elements as paragraph separators", async () => {
        vi.mocked(translateTextForPage).mockClear()
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <br />
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        await removeOrShowPageTranslation("translationOnly", true)

        expect(translateTextForPage).toHaveBeenCalledTimes(2)
        expect(translateTextForPage).toHaveBeenNthCalledWith(1, MOCK_ORIGINAL_TEXT, "html")
        expect(translateTextForPage).toHaveBeenNthCalledWith(2, MOCK_ORIGINAL_TEXT, "html")
      })
    })
  })

  describe("small paragraph filter", () => {
    const SHORT_TEXT = "Hi"
    const LONG_TEXT = "This is a longer text with multiple words for testing"

    const MIN_CHARS_CONFIG: Config = {
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        mode: "bilingual" as const,
        page: {
          ...DEFAULT_CONFIG.translate.page,
          minCharactersPerNode: 10,
          minWordsPerNode: 0,
        },
      },
    }

    const MIN_WORDS_CONFIG: Config = {
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        mode: "bilingual" as const,
        page: {
          ...DEFAULT_CONFIG.translate.page,
          minCharactersPerNode: 0,
          minWordsPerNode: 5,
        },
      },
    }

    async function translateWithConfig(config: Config, toggle: boolean = false) {
      const id = crypto.randomUUID()
      walkAndLabelElement(document.body, id, config)
      await act(async () => {
        await translateWalkedElement(document.body, id, config, toggle)
        flushBatchedOperations()
      })
    }

    describe("minCharactersPerNode filter", () => {
      it("should skip translation for text shorter than minCharactersPerNode", async () => {
        vi.mocked(translateTextForPage).mockClear()
        render(<div data-testid="test-node">{SHORT_TEXT}</div>)
        const node = screen.getByTestId("test-node")
        await translateWithConfig(MIN_CHARS_CONFIG, true)

        // Should not have translation wrapper because text is too short
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(translateTextForPage).not.toHaveBeenCalled()
      })

      it("should translate text longer than minCharactersPerNode", async () => {
        vi.mocked(translateTextForPage).mockClear()
        render(<div data-testid="test-node">{LONG_TEXT}</div>)
        const node = screen.getByTestId("test-node")
        await translateWithConfig(MIN_CHARS_CONFIG, true)

        // Should have translation wrapper because text is long enough
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
        expect(translateTextForPage).toHaveBeenCalled()
      })
    })

    describe("minWordsPerNode filter", () => {
      it("should skip translation for text with fewer words than minWordsPerNode", async () => {
        vi.mocked(translateTextForPage).mockClear()
        render(<div data-testid="test-node">Two words</div>)
        const node = screen.getByTestId("test-node")
        await translateWithConfig(MIN_WORDS_CONFIG, true)

        // Should not have translation wrapper because word count is too low
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(translateTextForPage).not.toHaveBeenCalled()
      })

      it("should translate text with more words than minWordsPerNode", async () => {
        vi.mocked(translateTextForPage).mockClear()
        render(<div data-testid="test-node">{LONG_TEXT}</div>)
        const node = screen.getByTestId("test-node")
        await translateWithConfig(MIN_WORDS_CONFIG, true)

        // Should have translation wrapper because word count is enough
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
        expect(translateTextForPage).toHaveBeenCalled()
      })
    })
  })
})
