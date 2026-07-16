export const CONTENT_WRAPPER_CLASS = "read-frog-translated-content-wrapper"
export const INLINE_CONTENT_CLASS = "read-frog-translated-inline-content"
export const BLOCK_CONTENT_CLASS = "read-frog-translated-block-content"
export const FLOAT_WRAP_ATTRIBUTE = "data-read-frog-float-wrap"

export const WALKED_ATTRIBUTE = "data-read-frog-walked"
// paragraph means you need to trigger translation on this element (i.e. we have inline children in it)
export const PARAGRAPH_ATTRIBUTE = "data-read-frog-paragraph"
export const BLOCK_ATTRIBUTE = "data-read-frog-block-node"
export const INLINE_ATTRIBUTE = "data-read-frog-inline-node"

export const TRANSLATION_MODE_ATTRIBUTE = "data-read-frog-translation-mode"
export const VIRTUAL_PARAGRAPH_ATTRIBUTE = "data-read-frog-virtual-paragraph"
// Marks an element whose own text nodes hold translated values (in-place swap,
// translationOnly mode) — the queryable handle for restore, since no wrapper
// remains in the DOM after a successful swap.
export const TRANSLATION_ONLY_ATTRIBUTE = "data-read-frog-translation-only"

export const MARK_ATTRIBUTES = new Set([
  WALKED_ATTRIBUTE,
  PARAGRAPH_ATTRIBUTE,
  BLOCK_ATTRIBUTE,
  INLINE_ATTRIBUTE,
])

export const NOTRANSLATE_CLASS = "notranslate"

export const REACT_SHADOW_HOST_CLASS = "read-frog-react-shadow-host"

export const SPINNER_CLASS = "read-frog-spinner"

export const TRANSLATION_ERROR_CONTAINER_CLASS = "read-frog-translation-error-container"
