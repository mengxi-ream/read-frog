import domRulesModule from '@/assets/dom-rules.json'

// Type definitions for DOM rules configuration
export interface DomRulesConfig {
  dontWalkIntoSelectors?: Record<string, string[]>
  forceBlockTranslationSelectors?: Record<string, string[]>
}

const domRules: DomRulesConfig = domRulesModule as DomRulesConfig

export const FORCE_BLOCK_TAGS = new Set([
  'BODY',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BR',
  'FORM',
  'SELECT',
  'BUTTON',
  'LABEL',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'ARTICLE',
  'SECTION',
  'FIGURE',
  'FIGCAPTION',
  'HEADER',
  'FOOTER',
  'MAIN',
  'NAV',
])

export const MATH_TAGS = new Set([
  'math',
  'maction',
  'annotation',
  'annotation-xml',
  'menclose',
  'merror',
  'mfenced',
  'mfrac',
  'mi',
  'mmultiscripts',
  'mn',
  'mo',
  'mover',
  'mpadded',
  'mphantom',
  'mprescripts',
  'mroot',
  'mrow',
  'ms',
  'mspace',
  'msqrt',
  'mstyle',
  'msub',
  'msubsup',
  'msup',
  'mtable',
  'mtd',
  'mtext',
  'mtr',
  'munder',
  'munderover',
  'semantics',
])

// Don't walk into these tags
export const DONT_WALK_AND_TRANSLATE_TAGS = new Set([
  'HEAD',
  'TITLE',
  'HR',
  'INPUT',
  'TEXTAREA',
  'IMG',
  'VIDEO',
  'AUDIO',
  'CANVAS',
  'SOURCE',
  'TRACK',
  'META',
  'SCRIPT',
  'NOSCRIPT',
  'STYLE',
  'LINK',
  'PRE',
  'svg',
  ...MATH_TAGS,
])

export const DONT_WALK_BUT_TRANSLATE_TAGS = new Set([
  'CODE',
  'TIME',
])

export const FORCE_INLINE_TRANSLATION_TAGS = new Set([
  'A',
  'BUTTON',
  'SELECT',
  'OPTION',
  'SPAN',
])

export const MAIN_CONTENT_IGNORE_TAGS = new Set(['HEADER', 'FOOTER', 'NAV', 'NOSCRIPT'])

/**
 * Convert glob pattern to RegExp for URL matching
 * Supports: *, **, and protocol-optional patterns
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

  regexStr = regexStr.replace(/\*\*/g, '§DBL§')
  regexStr = regexStr.replace(/\*/g, '[^/]*')
  regexStr = regexStr.replace(/§DBL§/g, '.*')
  regexStr = regexStr.replace(/^https?:\/\//, '(?:https?:\\/\\/)?')

  return new RegExp(`^${regexStr}$`, 'i')
}

export function matchUrlPattern(url: string, pattern: string): boolean {
  if (url === pattern)
    return true

  if (!pattern.includes('*')) {
    const cleanUrl = url.replace(/^https?:\/\//, '')
    const cleanPattern = pattern.replace(/^https?:\/\//, '')
    return cleanUrl === cleanPattern
  }

  const regex = globToRegex(pattern)
  if (regex.test(url))
    return true

  if (!pattern.startsWith('http://') && !pattern.startsWith('https://')) {
    return regex.test(url.replace(/^https?:\/\//, ''))
  }

  return false
}

export function findMatchingSelectors(
  ruleName: 'dontWalkIntoSelectors' | 'forceBlockTranslationSelectors',
  currentUrl?: string,
): string[] {
  // Not initialized yet
  if (!domRules)
    return []

  const ruleset = ruleName === 'dontWalkIntoSelectors' ? domRules.dontWalkIntoSelectors : domRules.forceBlockTranslationSelectors

  if (!ruleset)
    // invalid ruleset
    return []

  const url = currentUrl || window.location.href

  const hostname = new URL(url).hostname

  if (ruleset[hostname])
    return ruleset[hostname]
  if (ruleset[url])
    return ruleset[url]

  for (const [pattern, selectors] of Object.entries(ruleset || {})) {
    if (matchUrlPattern(url, pattern) || matchUrlPattern(hostname, pattern)) {
      return selectors
    }
  }

  return []
}
