export const FORCE_BLOCK_TAGS = new Set([
  'BODY',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
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

export const VALID_TRANSLATE_NODES = new Set([
  ...FORCE_BLOCK_TAGS,
  'DIV',
  'SPAN',
  'A',
])

// Don't walk into these tags
export const INVALID_TRANSLATE_TAGS = new Set([
  'HEAD',
  'BR',
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
])

export const FORCE_INLINE_TRANSLATION_TAGS = new Set([
  'A',
  'BUTTON',
  'SELECT',
  'OPTION',
  'SPAN',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
])

export const MAIN_CONTENT_IGNORE_TAGS = new Set(['HEADER', 'FOOTER', 'NAV'])
