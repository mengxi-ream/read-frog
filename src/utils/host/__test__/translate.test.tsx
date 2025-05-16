import { render, screen } from '@testing-library/react'

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import {
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
} from '@/utils/constants/translation'

import { translateNode, translatePage } from '../translate'
import { translateText } from '../translate-text'

vi.mock('../translate-text', () => ({
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
    document.body.innerHTML = ''
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

describe('translatePage', () => {
  it('should translate simple div node', async () => {
    render(<div data-testid="test-node">原文</div>)
    screen.getByTestId('test-node')

    await translatePage()
    const node = screen.getByTestId('test-node')
    expect(node.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(node.childNodes[1].childNodes[1]).toHaveClass(BLOCK_CONTENT_CLASS)
  })

  it('should insert inline translation and block translation correctly in a node with inline and block node inside', async () => {
    render(
      <div data-testid="test-node">
        <span style={{ display: 'inline' }}>1</span>
        <div>2</div>
        3
        <br />
        4
      </div>,
    )
    const node = screen.getByTestId('test-node')
    await translatePage()

    const firstSpanChild = node.firstChild
    expect(firstSpanChild).toHaveAttribute('data-read-frog-paragraph')
    expect(firstSpanChild?.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(firstSpanChild?.childNodes[1].childNodes[1]).toHaveClass(
      INLINE_CONTENT_CLASS,
    )

    const secondDivChild = node.childNodes[1]
    expect(secondDivChild).toHaveAttribute('data-read-frog-paragraph')
    expect(secondDivChild?.childNodes[1]).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(secondDivChild?.childNodes[1].childNodes[1]).toHaveClass(
      BLOCK_CONTENT_CLASS,
    )

    const forthInlineTranslationChild = node.childNodes[3]
    expect(forthInlineTranslationChild).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(forthInlineTranslationChild?.childNodes[1]).toHaveClass(
      INLINE_CONTENT_CLASS,
    )

    const lastInlineTranslationChild
      = node.childNodes[node.childNodes.length - 1]
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
    await translatePage()
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
    await translatePage()
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
    await translatePage()
    const targetNode = node.firstChild
    expect(targetNode?.lastChild).toHaveClass(CONTENT_WRAPPER_CLASS)
    expect(targetNode?.lastChild?.lastChild).toHaveClass(INLINE_CONTENT_CLASS)
  })
})
