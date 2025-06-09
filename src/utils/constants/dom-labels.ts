export const CONTENT_WRAPPER_CLASS = 'read-frog-translated-content-wrapper'
export const INLINE_CONTENT_CLASS = 'read-frog-translated-inline-content'
export const BLOCK_CONTENT_CLASS = 'read-frog-translated-block-content'

export const WALKED_ATTRIBUTE = 'data-read-frog-walked'
// paragraph means you need to trigger translation on this element (i.e. we have inline children in it)
export const PARAGRAPH_ATTRIBUTE = 'data-read-frog-paragraph'

export const BLOCK_ATTRIBUTE = 'data-read-frog-block-node'
export const INLINE_ATTRIBUTE = 'data-read-frog-inline-node'

// if the end of the consecutive inline node is a text node, we can't add this attribute to it
// therefore, only the consecutive inline html element can have this attribute
// this attribute is used to determine if the translation of this target node should be the next sibling, rather than inside the node
export const CONSECUTIVE_INLINE_END_ATTRIBUTE = 'data-read-frog-consecutive-consecutive-inline-end'

export const NOTRANSLATE_CLASS = 'notranslate'

export const REACT_SHADOW_HOST_CLASS = 'read-frog-react-shadow-host'

export const TRANSLATION_ERROR_CONTAINER_CLASS = 'read-frog-translation-error-container'
