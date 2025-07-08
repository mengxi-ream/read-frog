// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  BLOCK_CONTENT_CLASS,
  INLINE_CONTENT_CLASS,
} from '@/utils/constants/dom-labels'

import { isTranslatedContentNode } from '../filter'

describe('isTranslatedContentNode', () => {
  it('should return true for block translated content', () => {
    const element = document.createElement('span')
    element.className = BLOCK_CONTENT_CLASS
    expect(isTranslatedContentNode(element)).toBe(true)
  })

  it('should return true for inline translated content', () => {
    const element = document.createElement('span')
    element.className = INLINE_CONTENT_CLASS
    expect(isTranslatedContentNode(element)).toBe(true)
  })

  it('should return false for non-translated content', () => {
    const element = document.createElement('div')
    element.className = 'some-other-class'
    expect(isTranslatedContentNode(element)).toBe(false)
  })

  it('should return false for text nodes', () => {
    const textNode = document.createTextNode('text')
    expect(isTranslatedContentNode(textNode)).toBe(false)
  })

  it('should return true for elements with both classes', () => {
    const element = document.createElement('span')
    element.className = `${BLOCK_CONTENT_CLASS} ${INLINE_CONTENT_CLASS}`
    expect(isTranslatedContentNode(element)).toBe(true)
  })
})
