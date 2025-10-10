import type { Config } from '@/types/config/config'
// @vitest-environment jsdom
import type { TranslationMode } from '@/types/config/translate'
import { act, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import {
  BLOCK_ATTRIBUTE,
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_ATTRIBUTE,
  INLINE_CONTENT_CLASS,
  PARAGRAPH_ATTRIBUTE,
} from '@/utils/constants/dom-labels'
import { walkAndLabelElement } from '@/utils/host/dom/traversal'
import { translateWalkedElement } from '@/utils/host/translate/node-manipulation'
import { translateText } from '@/utils/host/translate/translate-text'
import { expectNodeLabels, expectTranslatedContent, expectTranslationWrapper, MOCK_ORIGINAL_TEXT, MOCK_TRANSLATION } from './utils'

vi.mock('@/utils/host/translate/translate-text', () => ({
  translateText: vi.fn(() => Promise.resolve(MOCK_TRANSLATION)),
  validateTranslationConfig: vi.fn(() => true),
}))

vi.mock('@/utils/config/config', () => ({
  getConfigFromStorage: vi.fn(),
}))

const BILINGUAL_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  translate: {
    ...DEFAULT_CONFIG.translate,
    mode: 'bilingual' as const,
  },
}

const TRANSLATION_ONLY_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  translate: {
    ...DEFAULT_CONFIG.translate,
    mode: 'translationOnly' as const,
  },
}

describe('translate', () => {
  // Setup and teardown for getComputedStyle mock
  const originalGetComputedStyle = window.getComputedStyle

  beforeAll(async () => {
    // Mock getConfigFromStorage to return DEFAULT_CONFIG
    const { getConfigFromStorage } = await import('@/utils/config/config')
    vi.mocked(getConfigFromStorage).mockResolvedValue(DEFAULT_CONFIG)

    window.getComputedStyle = vi.fn((element) => {
      const originalStyle = originalGetComputedStyle(element)
      if (originalStyle.float === '') {
        Object.defineProperty(originalStyle, 'float', {
          value: 'none',
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
  async function removeOrShowPageTranslation(translationMode: TranslationMode, toggle: boolean = false) {
    const id = crypto.randomUUID()

    walkAndLabelElement(document.body, id, translationMode === 'bilingual' ? BILINGUAL_CONFIG : TRANSLATION_ONLY_CONFIG)
    await act(async () => {
      await translateWalkedElement(document.body, id, toggle, translationMode === 'bilingual' ? BILINGUAL_CONFIG : TRANSLATION_ONLY_CONFIG)
    })
  }

  describe('translateText stub', () => {
    it('translateText should be mocked', async () => {
      expect(await translateText('任何文字')).toBe(MOCK_TRANSLATION)
    })
  })

  describe('block node with single child node', () => {
    describe('text node', () => {
      it('bilingual mode: should insert translation wrapper after original text node', async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.childNodes[1])
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it('translation only mode: should replace original text with translation wrapper', async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe('inline HTML node', () => {
      it('bilingual mode: should insert translation wrapper after inline node content', async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: 'inline' }}>
              {MOCK_ORIGINAL_TEXT}
            </div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper, INLINE_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it('translation only mode: should replace inline node content with translation wrapper', async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: 'inline' }}>
              {MOCK_ORIGINAL_TEXT}
            </span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.childNodes[0].childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe('block node', () => {
      it('bilingual mode: should insert translation wrapper after child block node content', async () => {
        render(
          <div data-testid="test-node">
            <div>{MOCK_ORIGINAL_TEXT}</div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it('translation only mode: should replace child block node content with translation wrapper', async () => {
        render(
          <div data-testid="test-node">
            <div>{MOCK_ORIGINAL_TEXT}</div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.childNodes[0].childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe('block node -> block node -> inline node', () => {
      it('bilingual mode: should insert translation wrapper after deepest inline node', async () => {
        render(
          <div data-testid="test-node">
            <div><span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span></div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.childNodes[0].childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper, INLINE_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it('translation only mode: should replace deepest inline node content with translation wrapper', async () => {
        render(
          <div data-testid="test-node">
            <div><span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span></div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.childNodes[0].childNodes[0].childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe('block node -> shallow inline node (block node) -> block node', () => {
      it('bilingual mode: should insert translation wrapper after deepest block node content', async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: 'inline' }}><div>{MOCK_ORIGINAL_TEXT}</div></div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.childNodes[0].childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it('translation only mode: should replace deepest block node content with translation wrapper', async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: 'inline' }}><div>{MOCK_ORIGINAL_TEXT}</div></div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.childNodes[0].childNodes[0].childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe('block node -> shallow inline node -> inline node', () => {
      it('bilingual mode: should insert translation wrapper after nested inline node content', async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: 'inline' }}><span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span></div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.childNodes[0].childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper, INLINE_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
      it('translation only mode: should replace nested inline node content with translation wrapper', async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: 'inline' }}><span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span></div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.childNodes[0].childNodes[0].childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })
    })
    describe('block node -> shallow inline node (inline node) -> inline node + inline node', () => {
      it('bilingual mode: should insert translation wrapper after parent inline node', async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: 'inline' }}>
              <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
              {MOCK_ORIGINAL_TEXT}
            </div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.childNodes[0].childNodes[2])
        expectTranslatedContent(wrapper, INLINE_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it('translation only mode: should replace parent inline node content with translation wrapper', async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: 'inline' }}>
              <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
              {MOCK_ORIGINAL_TEXT}
            </div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.childNodes[0].childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
    })
    describe('block node -> shallow inline node (block node) -> single inline node + block node', () => {
      it('bilingual mode: should insert separate wrappers for inline and block nodes', async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: 'inline' }}>
              <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
              <div>{MOCK_ORIGINAL_TEXT}</div>
            </div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper1 = expectTranslationWrapper(node.children[0].children[0], 'bilingual')
        expect(wrapper1).toBe(node.childNodes[0].childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper1, INLINE_CONTENT_CLASS)
        expectNodeLabels(node.children[0].children[1], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper2 = expectTranslationWrapper(node.children[0].children[1], 'bilingual')
        expect(wrapper2).toBe(node.childNodes[0].childNodes[1].childNodes[1])
        expectTranslatedContent(wrapper2, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it('translation only mode: should replace inline and block nodes with separate wrappers', async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: 'inline' }}>
              <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
              <div>{MOCK_ORIGINAL_TEXT}</div>
            </div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper1 = expectTranslationWrapper(node.children[0].children[0], 'translationOnly')
        expect(wrapper1).toBe(node.childNodes[0].childNodes[0].childNodes[0])
        const wrapper2 = expectTranslationWrapper(node.children[0].children[1], 'translationOnly')
        expect(wrapper2).toBe(node.childNodes[0].childNodes[1].childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      })
    })
    describe('block node -> shallow inline node (block node) -> inline nodes + block node', () => {
      it('bilingual mode: should insert wrapper after inline group and inside block node', async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: 'inline' }}>
              <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
              <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
              <div>{MOCK_ORIGINAL_TEXT}</div>
            </div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[1], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper1 = expectTranslationWrapper(node.children[0], 'bilingual')
        expect(wrapper1).toBe(node.childNodes[0].childNodes[2])
        expectTranslatedContent(wrapper1, INLINE_CONTENT_CLASS)
        const wrapper2 = expectTranslationWrapper(node.children[0].children[3], 'bilingual')
        expect(wrapper2).toBe(node.childNodes[0].childNodes[3].childNodes[1])
        expectTranslatedContent(wrapper2, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      })
      it('translation only mode: should replace inline group and block node content with wrappers', async () => {
        render(
          <div data-testid="test-node">
            <div style={{ display: 'inline' }}>
              <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
              <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
              <div>{MOCK_ORIGINAL_TEXT}</div>
            </div>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper1 = expectTranslationWrapper(node.children[0], 'translationOnly')
        expect(wrapper1).toBe(node.childNodes[0].childNodes[0])
        const wrapper2 = expectTranslationWrapper(node.children[0].children[1], 'translationOnly')
        expect(wrapper2).toBe(node.childNodes[0].childNodes[1].childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      })
    })
  })

  describe('block node with multiple child nodes', () => {
    describe('all inline HTML nodes', () => {
      it('bilingual mode: should insert wrapper after the last inline node', async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[1], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[2], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])

        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })

      it('translation only mode: should replace all inline nodes with single wrapper', async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
    })
    describe('text node and inline HTML nodes', () => {
      it('bilingual mode: should insert wrapper after the last inline node', async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it('translation only mode: should replace mixed text and inline nodes with single wrapper', async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
    })
    describe('inline nodes + block node + inline nodes', () => {
      it('bilingual mode: should insert three wrappers', async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            <div>{MOCK_ORIGINAL_TEXT}</div>
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper1 = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper1).toBe(node.childNodes[2])
        expectTranslatedContent(wrapper1, INLINE_CONTENT_CLASS)
        const wrapper2 = expectTranslationWrapper(node.children[2], 'bilingual')
        expect(wrapper2).toBe(node.childNodes[3].childNodes[1])
        expectTranslatedContent(wrapper2, BLOCK_CONTENT_CLASS)
        const wrapper3 = node.lastChild
        expect(wrapper3).toHaveClass(CONTENT_WRAPPER_CLASS)
        expectTranslatedContent(wrapper3 as Element, INLINE_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it('translation only mode: should replace inline groups and block node with separate wrappers', async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            <div>{MOCK_ORIGINAL_TEXT}</div>
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper1 = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper1).toBe(node.childNodes[0])
        const wrapper2 = expectTranslationWrapper(node.children[1], 'translationOnly')
        expect(wrapper2).toBe(node.childNodes[1].childNodes[0])
        const wrapper3 = node.lastChild
        expect(wrapper3).toHaveClass(CONTENT_WRAPPER_CLASS)

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
    })
    describe('floating inline HTML nodes', () => {
      it('bilingual mode: should insert wrapper after the last inline node', async () => {
        render(
          <div data-testid="test-node">
            <span style={{ float: 'left' }}>{MOCK_ORIGINAL_TEXT}</span>
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.childNodes[2])
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it('translation only mode: should replace floating and inline nodes with single wrapper', async () => {
        render(
          <div data-testid="test-node">
            <span style={{ float: 'left' }}>{MOCK_ORIGINAL_TEXT}</span>
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
    })
    describe('br dom between inline nodes', () => {
      it('bilingual mode: should insert separate wrappers for inline groups separated by br', async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            <br />
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            {MOCK_ORIGINAL_TEXT}
            <br />
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper1 = expectTranslationWrapper(node.children[0], 'bilingual')
        expect(wrapper1).toBe(node.childNodes[0].childNodes[1])
        expectTranslatedContent(wrapper1, INLINE_CONTENT_CLASS)
        expectNodeLabels(node.children[2], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper2 = node.children[3]
        expect(wrapper2).toHaveClass(CONTENT_WRAPPER_CLASS)
        expectTranslatedContent(wrapper2, INLINE_CONTENT_CLASS)
        expectNodeLabels(node.children[5], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper3 = expectTranslationWrapper(node.children[5], 'bilingual')
        expect(wrapper3).toBe(node.children[5].childNodes[1])
        expectTranslatedContent(wrapper3, INLINE_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it('translation only mode: should replace inline groups separated by br with wrappers', async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            <br />
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
            {MOCK_ORIGINAL_TEXT}
            <br />
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper1 = expectTranslationWrapper(node.children[0], 'translationOnly')
        expect(wrapper1).toBe(node.childNodes[0].childNodes[0])
        const wrapper2 = node.childNodes[2]
        expect(wrapper2).toHaveClass(CONTENT_WRAPPER_CLASS)
        const wrapper3 = expectTranslationWrapper(node.children[4], 'translationOnly')
        expect(wrapper3).toBe(node.childNodes[4].childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
    })
    describe('inline node has only one block node child', () => {
      // Github issue: https://github.com/mengxi-ream/read-frog/issues/530
      it('bilingual mode: should insert wrapper after the block node', async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: 'inline' }}><div style={{ display: 'block' }}>{MOCK_ORIGINAL_TEXT}</div></span>
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[1], [INLINE_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it('translation only mode: should replace inline nodes with single wrapper', async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <span style={{ display: 'inline' }}><div style={{ display: 'block' }}>{MOCK_ORIGINAL_TEXT}</div></span>
            <span style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.childNodes[0])

        await removeOrShowPageTranslation('translationOnly', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it('should treat inline element with only one block child as inline (not block)', async () => {
        // https://github.com/mengxi-ream/read-frog/issues/530
        render(
          <div data-testid="test-node">
            <span style={{ display: 'inline' }}>
              {/* whitespace nodes should not count as meaningful children */}
              {'\n  '}
              <div style={{ display: 'block' }}>{MOCK_ORIGINAL_TEXT}</div>
              {'\n  '}
            </span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        const inlineSpan = node.children[0] as HTMLElement
        await removeOrShowPageTranslation('bilingual', true)

        // The span should be labeled as INLINE, not BLOCK, because it has only one meaningful child
        expectNodeLabels(inlineSpan, [INLINE_ATTRIBUTE])
        expectNodeLabels(inlineSpan.children[0], [BLOCK_ATTRIBUTE])
      })
      it('should treat inline element with only one block child and other nodes as block', async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: 'inline' }}>
              <div style={{ display: 'block' }}>{MOCK_ORIGINAL_TEXT}</div>
              {MOCK_ORIGINAL_TEXT}
            </span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [BLOCK_ATTRIBUTE])

        const wrapper = expectTranslationWrapper(node.children[0].children[0], 'bilingual')
        expect(wrapper).toBe(node.children[0].children[0].lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

        const wrapper2 = node.children[0].lastChild as Element
        expect(wrapper2).toHaveClass(CONTENT_WRAPPER_CLASS)
        expectTranslatedContent(wrapper2, INLINE_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
      it('should treat inline element with only one block child which one block child and other nodes as block', async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: 'inline' }}>
              <div style={{ display: 'block' }}>
                <div style={{ display: 'block' }}>{MOCK_ORIGINAL_TEXT}</div>
                <div style={{ display: 'block' }}>{MOCK_ORIGINAL_TEXT}</div>
                <div style={{ display: 'block' }}>{MOCK_ORIGINAL_TEXT}</div>
              </div>
            </span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node.children[0], [BLOCK_ATTRIBUTE])
        expectNodeLabels(node.children[0].children[0], [BLOCK_ATTRIBUTE])

        const wrapper = expectTranslationWrapper(node.children[0].children[0].children[0], 'bilingual')
        expect(wrapper).toBe(node.children[0].children[0].children[0].lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
        const wrapper2 = expectTranslationWrapper(node.children[0].children[0].children[1], 'bilingual')
        expect(wrapper2).toBe(node.children[0].children[0].children[1].lastChild)
        expectTranslatedContent(wrapper2, BLOCK_CONTENT_CLASS)
        const wrapper3 = expectTranslationWrapper(node.children[0].children[0].children[2], 'bilingual')
        expect(wrapper3).toBe(node.children[0].children[0].children[2].lastChild)
        expectTranslatedContent(wrapper3, BLOCK_CONTENT_CLASS)

        await removeOrShowPageTranslation('bilingual', true)
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(`${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}${MOCK_ORIGINAL_TEXT}`)
      })
    })
  })
  describe('empty text nodes with only one inline node in middle', () => {
    it('bilingual mode: should insert translation wrapper in inline node', async () => {
      render(
        <div data-testid="test-node">
          {' '}
          <div style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</div>
          {'\n '}
        </div>,
      )
      const node = screen.getByTestId('test-node')
      await removeOrShowPageTranslation('bilingual', true)

      expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      const wrapper = expectTranslationWrapper(node.children[0], 'bilingual')
      expect(wrapper).toBe(node.children[0].lastChild)
      expectTranslatedContent(wrapper, INLINE_CONTENT_CLASS)

      await removeOrShowPageTranslation('bilingual', true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(` ${MOCK_ORIGINAL_TEXT}\n `)
    })
    it('translation only mode: should have translation wrapper in inline node', async () => {
      render(
        <div data-testid="test-node">
          {' '}
          <div style={{ display: 'inline' }}>{MOCK_ORIGINAL_TEXT}</div>
          {'\n '}
        </div>,
      )
      const node = screen.getByTestId('test-node')
      await removeOrShowPageTranslation('translationOnly', true)

      expectNodeLabels(node.children[0], [INLINE_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      const wrapper = expectTranslationWrapper(node.children[0], 'translationOnly')
      expect(wrapper).toBe(node.children[0].childNodes[0])

      await removeOrShowPageTranslation('translationOnly', true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(` ${MOCK_ORIGINAL_TEXT}\n `)
    })
  })
  describe('empty text nodes with "no need to translate" node in middle', () => {
    it('bilingual mode: should not insert translation wrapper', async () => {
      render(
        <div data-testid="test-node">
          {' '}
          <div>{MOCK_TRANSLATION}</div>
          {' '}
        </div>,
      )
      const node = screen.getByTestId('test-node')
      await removeOrShowPageTranslation('bilingual', true)

      // test no translation wrapper
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(` ${MOCK_TRANSLATION} `)

      await removeOrShowPageTranslation('bilingual', true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(` ${MOCK_TRANSLATION} `)
    })
    it('translation only mode: should have translation wrapper', async () => {
    // Mock translateText to return the exact HTML string with spaces
      const TRANSLATED_TEXT = `<div>${MOCK_TRANSLATION}</div>`
      vi.mocked(translateText).mockResolvedValueOnce(TRANSLATED_TEXT)

      render(
        <div data-testid="test-node">
          <div>{MOCK_TRANSLATION}</div>
        </div>,
      )
      const node = screen.getByTestId('test-node')
      await removeOrShowPageTranslation('translationOnly', true)

      const wrapper = node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
      expect(wrapper).toBeTruthy()
      expect(wrapper?.innerHTML).toBe(TRANSLATED_TEXT)

      await removeOrShowPageTranslation('translationOnly', true)
      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
    })
  })
  describe('switching between translation modes', () => {
    it('should properly clean up translations when switching from bilingual to translation-only mode', async () => {
      render(
        <div data-testid="test-node">
          {MOCK_ORIGINAL_TEXT}
        </div>,
      )
      const node = screen.getByTestId('test-node')
      await removeOrShowPageTranslation('bilingual', true)
      await removeOrShowPageTranslation('translationOnly', true)

      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
    })
    it('should properly clean up translations when switching from translation-only to bilingual mode', async () => {
      render(
        <div data-testid="test-node">
          {MOCK_ORIGINAL_TEXT}
        </div>,
      )
      const node = screen.getByTestId('test-node')
      await removeOrShowPageTranslation('translationOnly', true)
      await removeOrShowPageTranslation('bilingual', true)

      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
    })
  })

  describe('pre and code tag handling', () => {
    describe('pre tag - should not translate content inside pre', () => {
      it('bilingual mode: should not translate content inside pre tag', async () => {
        render(
          <div data-testid="test-node">
            <pre>{MOCK_ORIGINAL_TEXT}</pre>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        // Should not have any translation wrapper
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })

      it('translation only mode: should not translate content inside pre tag', async () => {
        render(
          <div data-testid="test-node">
            <pre>{MOCK_ORIGINAL_TEXT}</pre>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        // Should not have any translation wrapper
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(MOCK_ORIGINAL_TEXT)
      })

      it('bilingual mode: should not translate pre with multiple lines', async () => {
        const codeContent = `function test() {
  return "hello"
}`
        render(
          <div data-testid="test-node">
            <pre>{codeContent}</pre>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe(codeContent)
      })
    })

    describe('code tag - should not walk into but translate as child', () => {
      it('bilingual mode: should translate text with code elements', async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <code>{MOCK_ORIGINAL_TEXT}</code>
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expect(wrapper).toBe(node.lastChild)
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
      })

      it('translation only mode: should translate text with code elements', async () => {
        render(
          <div data-testid="test-node">
            {MOCK_ORIGINAL_TEXT}
            <code>{MOCK_ORIGINAL_TEXT}</code>
            {MOCK_ORIGINAL_TEXT}
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBe(node.children[0])
      })
    })
  })

  describe('numeric content handling', () => {
    describe('bilingual mode', () => {
      it('should not translate pure numbers', async () => {
        render(
          <div data-testid="test-node">
            12345
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        // Should not have any translation wrapper
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe('12345')
      })

      it('should not translate numbers with thousand separators', async () => {
        render(
          <div data-testid="test-node">
            1,234,567
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe('1,234,567')
      })

      it('should not translate decimal numbers', async () => {
        render(
          <div data-testid="test-node">
            3.14159
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe('3.14159')
      })

      it('should translate text with numbers mixed in', async () => {
        render(
          <div data-testid="test-node">
            原文 123 文字
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        // Should have translation wrapper since it contains text
        const wrapper = expectTranslationWrapper(node, 'bilingual')
        expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)
      })
    })

    describe('translation only mode', () => {
      it('should not translate pure numbers', async () => {
        render(
          <div data-testid="test-node">
            67890
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        // Should not have any translation wrapper
        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe('67890')
      })

      it('should not translate numbers with spaces', async () => {
        render(
          <div data-testid="test-node">
            1 234 567
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe('1 234 567')
      })

      it('should not translate European format numbers', async () => {
        render(
          <div data-testid="test-node">
            1.234,56
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe('1.234,56')
      })

      it('should translate text with numbers', async () => {
        render(
          <div data-testid="test-node">
            原文包含数字 999
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        // Should have translation wrapper since it contains text
        const wrapper = expectTranslationWrapper(node, 'translationOnly')
        expect(wrapper).toBeTruthy()
      })
    })

    describe('numeric content with multiple nodes', () => {
      it('bilingual mode: should not translate when all nodes contain only numbers', async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: 'inline' }}>123</span>
            <span style={{ display: 'inline' }}>456</span>
            <span style={{ display: 'inline' }}>789</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('bilingual', true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe('123456789')
      })

      it('translation only mode: should not translate when all nodes contain only numbers', async () => {
        render(
          <div data-testid="test-node">
            <span style={{ display: 'inline' }}>100</span>
            <span style={{ display: 'inline' }}>200</span>
            <span style={{ display: 'inline' }}>300</span>
          </div>,
        )
        const node = screen.getByTestId('test-node')
        await removeOrShowPageTranslation('translationOnly', true)

        expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
        expect(node.textContent).toBe('100200300')
      })
    })
  })
})
