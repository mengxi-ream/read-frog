import { render, screen } from '@testing-library/react'

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import {
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
} from '@/utils/constants/dom-labels'

import { translateWalkedElement, walkAndLabelElement } from '../dom/traversal'
import { hideOrShowNodeTranslation, translateNodes } from '../translate/node-manipulation'
import { translateText } from '../translate/translate-text'

vi.mock('../translate/translate-text', () => ({
  translateText: vi.fn(() => Promise.resolve('translation')),
}))

async function hideOrShowPageTranslation(toggle: boolean = false) {
  const id = crypto.randomUUID()

  walkAndLabelElement(document.body, id)
  await translateWalkedElement(document.body, id, toggle)
}

describe('translateText stub', () => {
  it('translateText should be mocked', async () => {
    expect(await translateText('任何文字')).toBe('translation')
  })
})

describe('translateNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.textContent = ''
  })

  it('should insert wrapper into block node', async () => {
    render(
      <div
        data-testid="test-node"
        data-read-frog-block-node
        data-read-frog-paragraph
      >
        原文
      </div>,
    )
    const node = screen.getByTestId('test-node')
    await translateNodes([node], false)
    expect(node.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(node.childNodes[1].childNodes[1]).toHaveClass(BLOCK_CONTENT_CLASS)
  })

  it('should insert wrapper after text node', async () => {
    render(
      <div data-testid="test-node">
        原文
        <div>123</div>
      </div>,
    )
    const node = screen.getByTestId('test-node')
    const textNode = node.firstChild as Text
    await translateNodes([textNode], false)
    expect(node.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(node.childNodes[1].childNodes[1]).toHaveClass(INLINE_CONTENT_CLASS)
  })
})

describe('toggle translateWalkedElement', () => {
  it('should show then hide the block node translation', async () => {
    render(
      <div
        data-testid="test-node"
      >
        原文
      </div>,
    )
    const node = screen.getByTestId('test-node')
    await hideOrShowPageTranslation(true)

    expect(node.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(node.childNodes[1].childNodes[1]).toHaveClass(BLOCK_CONTENT_CLASS)

    await hideOrShowPageTranslation(true)
    expect(node.childNodes.length).toBe(1)
  })
  it('should show then hide the inline html node translation', async () => {
    render(
      <div
        data-testid="test-node"
        style={{ display: 'inline' }}
      >
        123
      </div>,
    )
    const node = screen.getByTestId('test-node')
    await hideOrShowPageTranslation(true)
    expect(node.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(node.childNodes[1].childNodes[1]).toHaveClass(INLINE_CONTENT_CLASS)

    await hideOrShowPageTranslation(true)
    expect(node.childNodes.length).toBe(1)
  })
  it('should show then hide the inline text node translation', async () => {
    render(
      <div
        data-testid="test-node"
      >
        1
        <div style={{ display: 'block' }}>2</div>
      </div>,
    )
    const node = screen.getByTestId('test-node')
    await hideOrShowPageTranslation(true)
    expect(node.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(node.childNodes[1].childNodes[1]).toHaveClass(INLINE_CONTENT_CLASS)

    await hideOrShowPageTranslation(true)
    expect(node.childNodes.length).toBe(2)
  })
  it('should show then hide the consecutive inline text node translation', async () => {
    render(
      <div
        data-testid="test-node"
      >
        1
        <span style={{ display: 'inline' }}>2</span>
        <div style={{ display: 'block' }}>3</div>
      </div>,
    )
    const node = screen.getByTestId('test-node')
    await hideOrShowPageTranslation(true)
    expect(node.childNodes[2]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(node.childNodes[2].childNodes[1]).toHaveClass(INLINE_CONTENT_CLASS)

    await hideOrShowPageTranslation(true)
    expect(node.childNodes.length).toBe(3)
  })
})

describe('translatePage', () => {
  it('should translate simple div node', async () => {
    render(<div data-testid="test-node">原文</div>)
    screen.getByTestId('test-node')

    await hideOrShowPageTranslation()
    const node = screen.getByTestId('test-node')
    expect(node.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(node.childNodes[1].childNodes[1]).toHaveClass(BLOCK_CONTENT_CLASS)
  })

  it('should insert inline translation and block translation correctly in a node with inline and block node inside', async () => {
    render(
      <div data-testid="test-node">
        <span style={{ display: 'inline' }}>1</span>
        <div style={{ display: 'block' }}>2</div>
        <span style={{ display: 'inline' }}>3</span>
        4
        <span style={{ display: 'block' }}>5</span>
        6
        <br />
        7
      </div>,
    )
    const node = screen.getByTestId('test-node')
    await hideOrShowPageTranslation()

    const firstSpanChild = node.firstChild
    expect(firstSpanChild).toHaveAttribute('data-read-frog-paragraph')
    expect(firstSpanChild?.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(firstSpanChild?.childNodes[1].childNodes[1]).toHaveClass(
      INLINE_CONTENT_CLASS,
    )

    const thirdDivChild = node.childNodes[1]
    expect(thirdDivChild).toHaveAttribute('data-read-frog-paragraph')
    expect(thirdDivChild?.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(thirdDivChild?.childNodes[1].childNodes[1]).toHaveClass(
      BLOCK_CONTENT_CLASS,
    )

    const sixthInlineTranslationChild = node.childNodes[4]
    expect(sixthInlineTranslationChild).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(sixthInlineTranslationChild?.childNodes[1]).toHaveClass(
      INLINE_CONTENT_CLASS,
    )

    const lastInlineTranslationChild = node.lastChild
    expect(lastInlineTranslationChild).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(lastInlineTranslationChild?.childNodes[1]).toHaveClass(
      INLINE_CONTENT_CLASS,
    )
  })
  it('should translate the deepest inline node', async () => {
    render(
      <div data-testid="test-node">
        <span style={{ display: 'inline' }}>
          <span style={{ display: 'inline' }}>1</span>
        </span>
      </div>,
    )

    const node = screen.getByTestId('test-node')
    await hideOrShowPageTranslation()

    const targetNode = node.firstChild?.firstChild
    expect(targetNode?.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(targetNode?.childNodes[1].childNodes[1]).toHaveClass(
      INLINE_CONTENT_CLASS,
    )
  })
  it('should translate the deepest block node', async () => {
    render(
      <div data-testid="test-node">
        <div>
          <div>1</div>
        </div>
      </div>,
    )
    const node = screen.getByTestId('test-node')
    await hideOrShowPageTranslation()
    const targetNode = node.firstChild?.firstChild
    expect(targetNode?.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(targetNode?.childNodes[1].childNodes[1]).toHaveClass(
      BLOCK_CONTENT_CLASS,
    )
  })
  it('should translate the middle node', async () => {
    render(
      <div data-testid="test-node">
        <span style={{ display: 'inline' }}>
          <div className="test" style={{ display: 'inline' }}>
            1
          </div>
          2
        </span>
      </div>,
    )
    const node = screen.getByTestId('test-node')
    await hideOrShowPageTranslation()
    const targetNode = node.firstChild
    expect(targetNode?.lastChild).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(targetNode?.lastChild?.lastChild).toHaveClass(INLINE_CONTENT_CLASS)
  })
})

describe('hideOrShowNodeTranslation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('should show translation when hotkey is pressed over original text', async () => {
    const originalElement = document.createElement('div')
    originalElement.textContent = 'Original text'
    originalElement.style.position = 'absolute'
    originalElement.style.left = '100px'
    originalElement.style.top = '100px'
    originalElement.style.width = '200px'
    originalElement.style.height = '50px'
    document.body.appendChild(originalElement)

    // Mock getBoundingClientRect
    originalElement.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      top: 100,
      right: 300,
      bottom: 150,
      width: 200,
      height: 50,
    } as DOMRect))

    // Mock elementFromPoint
    document.elementFromPoint = vi.fn(() => originalElement)

    await hideOrShowNodeTranslation({ x: 150, y: 125 })

    // Should find translation wrapper
    const wrapper = document.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
    expect(wrapper).toBeTruthy()
  })

  it('should hide translation when hotkey is pressed over translated content', async () => {
    const originalElement = document.createElement('div')
    originalElement.textContent = 'Original text'
    document.body.appendChild(originalElement)

    // Create translated content structure
    const wrapper = document.createElement('span')
    wrapper.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`

    const translatedContent = document.createElement('span')
    translatedContent.className = `${NOTRANSLATE_CLASS} ${BLOCK_CONTENT_CLASS}`
    translatedContent.textContent = 'Translated text'
    translatedContent.style.position = 'absolute'
    translatedContent.style.left = '100px'
    translatedContent.style.top = '100px'
    translatedContent.style.width = '200px'
    translatedContent.style.height = '50px'

    wrapper.appendChild(translatedContent)
    originalElement.appendChild(wrapper)

    // Mock getBoundingClientRect for translated content
    translatedContent.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      top: 100,
      right: 300,
      bottom: 150,
      width: 200,
      height: 50,
    } as DOMRect))

    // Mock elementFromPoint to return translated content
    document.elementFromPoint = vi.fn(() => translatedContent)

    await hideOrShowNodeTranslation({ x: 150, y: 125 })

    // Wrapper should be removed
    expect(document.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeFalsy()
  })
})
