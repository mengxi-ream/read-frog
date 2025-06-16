export const MIN_SIDE_CONTENT_WIDTH = 400 // px
export const DEFAULT_SIDE_CONTENT_WIDTH = 400 // px

export const DOWNLOAD_FILE_ITEMS = {
  md: {
    label: 'Markdown',
  },
}

// 段落深度
export const PARAGRAPH_DEPTH = 3

export enum MARKDOWN_TEMPLATE_TOKEN {
  title = '{{ Read Frog: title }}',
  sentence = '{{ Read Frog:sentence }}',
  words = '{{ Read Frog:words }}',
  explanation = '{{ Read Frog:explanation }}',
  originalSentence = '{{ Read Frog:originalSentence }}',
  translatedSentence = '{{ Read Frog:translatedSentence }}',
  word = '{{ Read Frog:word }}',
  syntacticCategory = '{{ Read Frog:syntacticCategory }}',
  wIndex = '{{ Read Frog:wIndex }}',
  globalIndex = '{{ Read Frog:globalIndex }}',
}

export const AST_TEMPLATE = `
# ${MARKDOWN_TEMPLATE_TOKEN.title}

${MARKDOWN_TEMPLATE_TOKEN.sentence}
`

export const SENTENCE_TEMPLATE = `
## Sentence ${MARKDOWN_TEMPLATE_TOKEN.globalIndex}

**${MARKDOWN_TEMPLATE_TOKEN.originalSentence}**

${MARKDOWN_TEMPLATE_TOKEN.translatedSentence}

### Key Words

${MARKDOWN_TEMPLATE_TOKEN.words}

### Explanation

${MARKDOWN_TEMPLATE_TOKEN.explanation}
`

export const WORDS_TEMPLATE = `${MARKDOWN_TEMPLATE_TOKEN.wIndex}. **${MARKDOWN_TEMPLATE_TOKEN.word}** ${MARKDOWN_TEMPLATE_TOKEN.syntacticCategory}
  ${MARKDOWN_TEMPLATE_TOKEN.explanation}
`
