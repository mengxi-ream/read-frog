// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import {
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
} from '@/utils/constants/dom-labels'

import { findTranslatedContentWrapper } from '../find'

describe('findTranslatedContentWrapper', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('should find nearest wrapper for block translated content', () => {
    const wrapper = document.createElement('span')
    wrapper.className = CONTENT_WRAPPER_CLASS

    const parent = document.createElement('div')
    parent.appendChild(wrapper)

    const translatedContent = document.createElement('span')
    translatedContent.className = BLOCK_CONTENT_CLASS
    wrapper.appendChild(translatedContent)

    document.body.appendChild(parent)

    const result = findTranslatedContentWrapper(translatedContent)
    expect(result).toBe(wrapper)
  })

  it('should find nearest wrapper for inline translated content', () => {
    const wrapper = document.createElement('span')
    wrapper.className = CONTENT_WRAPPER_CLASS

    const translatedContent = document.createElement('span')
    translatedContent.className = INLINE_CONTENT_CLASS
    wrapper.appendChild(translatedContent)

    document.body.appendChild(wrapper)

    const result = findTranslatedContentWrapper(translatedContent)
    expect(result).toBe(wrapper)
  })

  it('should return null for non-translated content', () => {
    const element = document.createElement('div')
    element.className = 'not-translated'

    const result = findTranslatedContentWrapper(element)
    expect(result).toBe(null)
  })

  it('should return null if no wrapper found', () => {
    const translatedContent = document.createElement('span')
    translatedContent.className = BLOCK_CONTENT_CLASS
    document.body.appendChild(translatedContent)

    const result = findTranslatedContentWrapper(translatedContent)
    expect(result).toBe(null)
  })

  it('should find wrapper through multiple parent levels', () => {
    const wrapper = document.createElement('span')
    wrapper.className = CONTENT_WRAPPER_CLASS

    const middleParent = document.createElement('div')
    const immediateParent = document.createElement('p')

    const translatedContent = document.createElement('span')
    translatedContent.className = BLOCK_CONTENT_CLASS

    // Structure: wrapper > middleParent > immediateParent > translatedContent
    wrapper.appendChild(middleParent)
    middleParent.appendChild(immediateParent)
    immediateParent.appendChild(translatedContent)

    document.body.appendChild(wrapper)

    const result = findTranslatedContentWrapper(translatedContent)
    expect(result).toBe(wrapper)
  })
})
