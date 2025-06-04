import { render, screen } from '@testing-library/react'

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import {
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
} from '@/utils/constants/translation'

import { hideOrShowPageTranslation, translateNode } from '../translate/node-manipulation'
import { translateText } from '../translate/translate-text'

vi.mock('../translate/translate-text', () => ({
  translateText: vi.fn(() => Promise.resolve('translation')),
}))

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
    await translateNode(node, false)
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
    await translateNode(textNode, false)
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
