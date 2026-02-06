import domRulesModule from '@/assets/dom-rules.json'

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
 * Supports: * (single segment) and ** (any depth)
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

  regexStr = regexStr.replace(/\*\*/g, '§DBL§')
  regexStr = regexStr.replace(/\*/g, '[^/]*')
  regexStr = regexStr.replace(/§DBL§/g, '.*')

  return new RegExp(`^${regexStr}$`, 'i')
}

/** Protocol-agnostic URL matching with glob support */
export function matchUrlPattern(url: string, pattern: string): boolean {
  const cleanUrl = url.replace(/^https?:\/\//, '')
  const cleanPattern = pattern.replace(/^https?:\/\//, '')

  if (!pattern.includes('*'))
    return cleanUrl === cleanPattern

  return globToRegex(cleanPattern).test(cleanUrl)
}

export function findMatchingSelectors(
  ruleName: 'dontWalkIntoSelectors' | 'forceBlockTranslationSelectors',
  currentUrl?: string,
): string[] {
  const ruleset = domRules?.[ruleName]
  if (!ruleset)
    return []

  const url = currentUrl || window.location.href
  const hostname = new URL(url).hostname

  // Fast path: O(1) exact key lookup before O(n) glob matching
  if (ruleset[hostname])
    return ruleset[hostname]

  for (const [pattern, selectors] of Object.entries(ruleset)) {
    if (matchUrlPattern(url, pattern) || matchUrlPattern(hostname, pattern))
      return selectors
  }

  return []
}
