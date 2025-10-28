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

export const CUSTOM_DONT_WALK_INTO_ELEMENT_SELECTOR_MAP: Record<string, string[]> = {
  'chatgpt.com': [
    '.ProseMirror',
  ],
  'arxiv.org': [
    '.ltx_listing',
  ],
  'www.reddit.com': [
    'faceplate-screen-reader-content > *',
    'reddit-header-large *',
  ],
}
