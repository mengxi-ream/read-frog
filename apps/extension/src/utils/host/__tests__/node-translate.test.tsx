// @vitest-environment jsdom
import type { Config } from '@/types/config/config'
import { act, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { BLOCK_ATTRIBUTE, BLOCK_CONTENT_CLASS, CONTENT_WRAPPER_CLASS, PARAGRAPH_ATTRIBUTE } from '@/utils/constants/dom-labels'
import { flushBatchedOperations } from '../dom/batch-dom'
import { removeOrShowNodeTranslation } from '../translate/node-manipulation'
import { expectNodeLabels, expectTranslatedContent, expectTranslationWrapper, MOCK_ORIGINAL_TEXT } from './utils'

// Test config with fixed bilingual mode - won't change with DEFAULT_CONFIG
const TEST_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  translate: {
    ...DEFAULT_CONFIG.translate,
    mode: 'bilingual' as const,
  },
}

vi.mock('@/utils/host/translate/translate-text', () => ({
  translateText: vi.fn(() => Promise.resolve('translation')),
  validateTranslationConfig: vi.fn(() => true),
}))

vi.mock('@/utils/config/config', () => ({
  getConfigFromStorage: vi.fn(),
}))

describe('node translation', () => {
  const originalGetComputedStyle = window.getComputedStyle

  beforeAll(async () => {
    // Mock getConfigFromStorage to return TEST_CONFIG with bilingual mode
    const { getConfigFromStorage } = await import('@/utils/config/config')
    vi.mocked(getConfigFromStorage).mockResolvedValue(TEST_CONFIG)

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
  describe('show translation', () => {
    it('should show the translation when point is over the original text', async () => {
      render(
        <div data-testid="test-node">
          {MOCK_ORIGINAL_TEXT}
        </div>,
      )
      const node = screen.getByTestId('test-node')
      const originalElementFromPoint = document.elementFromPoint
      document.elementFromPoint = vi.fn(() => node)
      await act(async () => {
        await removeOrShowNodeTranslation({ x: 150, y: 125 }, TEST_CONFIG)
        // Flush batched DOM operations to ensure all changes are applied before assertions
        flushBatchedOperations()
      })

      expectNodeLabels(node, [BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE])
      const wrapper = expectTranslationWrapper(node, 'bilingual')
      expect(wrapper).toBe(node.childNodes[1])
      expectTranslatedContent(wrapper, BLOCK_CONTENT_CLASS)

      document.elementFromPoint = originalElementFromPoint
    })
  })
  describe('hide translation', () => {
    it('should hide the translation when point is over the translation content node', async () => {
      render(
        <div data-testid="test-node">
          {MOCK_ORIGINAL_TEXT}
        </div>,
      )
      const node = screen.getByTestId('test-node')

      const originalElementFromPoint = document.elementFromPoint
      document.elementFromPoint = vi.fn(() => node)
      await act(async () => {
        await removeOrShowNodeTranslation({ x: 150, y: 125 }, TEST_CONFIG)
        flushBatchedOperations()
      })

      const translatedContent = node.querySelector(`.${BLOCK_CONTENT_CLASS}`)
      document.elementFromPoint = vi.fn(() => translatedContent as Element)
      await act(async () => {
        await removeOrShowNodeTranslation({ x: 150, y: 125 }, TEST_CONFIG)
        flushBatchedOperations()
      })

      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent?.trim()).toBe(MOCK_ORIGINAL_TEXT)

      document.elementFromPoint = originalElementFromPoint
    })
    it('should hide the translation when point is over the translation wrapper', async () => {
      render(
        <div data-testid="test-node">
          {MOCK_ORIGINAL_TEXT}
        </div>,
      )
      const node = screen.getByTestId('test-node')
      const originalElementFromPoint = document.elementFromPoint
      document.elementFromPoint = vi.fn(() => node)
      await act(async () => {
        await removeOrShowNodeTranslation({ x: 150, y: 125 }, TEST_CONFIG)
      })
      const wrapper = node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
      document.elementFromPoint = vi.fn(() => wrapper as Element)
      await act(async () => {
        await removeOrShowNodeTranslation({ x: 150, y: 125 }, TEST_CONFIG)
      })

      expect(node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
      expect(node.textContent?.trim()).toBe(MOCK_ORIGINAL_TEXT)

      document.elementFromPoint = originalElementFromPoint
    })
  })
})
