import type { ArticleExplanation, ArticleWord } from '@/types/content'
import type { DOWNLOAD_FILE_ITEMS } from '@/utils/constants/side'
import { saveAs } from 'file-saver'
import { toast } from 'sonner'
import { AST_TEMPLATE, MARKDOWN_TEMPLATE_TOKEN, PARAGRAPH_DEPTH, SENTENCE_TEMPLATE, WORDS_TEMPLATE } from '@/utils/constants/side'

export type DOWNLOAD_FILE_TYPES = keyof typeof DOWNLOAD_FILE_ITEMS

type ExplanationDataList = Array<ArticleExplanation['paragraphs']>
type DOWNLOADER_MAP = Record<DOWNLOAD_FILE_TYPES, (explainDataList: ExplanationDataList, opts?: object) => void>

class Downloader {
  title = document.title ?? 'Untitled'
  downloader: DOWNLOADER_MAP = {
    md: this.downloadMarkdown,
  }

  download(explainDataList: ExplanationDataList, fileType: DOWNLOAD_FILE_TYPES, opts?: object) {
    this.downloader[fileType].call(this, explainDataList, opts)
  }

  downloadMarkdown(explainDataList: ExplanationDataList) {
    try {
      const article = this.markdownParser(explainDataList)

      const blob = new Blob([article], {
        type: 'text/plain',
      })

      saveAs(blob, `${this.title}.md`)
    }
    catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
      else {
        toast.error('Something went wrong when exporting...')
      }
    }
  }

  markdownParser(explainDataList: ExplanationDataList = []) {
    const sentence = this.parseSentence(explainDataList)

    return AST_TEMPLATE
      .replace(MARKDOWN_TEMPLATE_TOKEN.title, this.title)
      .replace(MARKDOWN_TEMPLATE_TOKEN.sentence, sentence)
  }

  parseSentence(explainDataList: ExplanationDataList = []) {
    const list = explainDataList.flat(PARAGRAPH_DEPTH)
    return list.reduce((sentence, paragraph, pIndex) => {
      const words = paragraph.words ?? []

      return sentence + SENTENCE_TEMPLATE
        .replace(MARKDOWN_TEMPLATE_TOKEN.originalSentence, paragraph.originalSentence)
        .replace(MARKDOWN_TEMPLATE_TOKEN.translatedSentence, paragraph.translatedSentence)
        .replace(MARKDOWN_TEMPLATE_TOKEN.words, this.parseWords(words))
        .replace(MARKDOWN_TEMPLATE_TOKEN.explanation, paragraph.explanation)
        .replace(MARKDOWN_TEMPLATE_TOKEN.globalIndex, (pIndex + 1).toString())
    }, '')
  }

  parseWords(words: ArticleWord[]) {
    return words.reduce((text, word, wIndex) => {
      return text + WORDS_TEMPLATE
        .replace(MARKDOWN_TEMPLATE_TOKEN.wIndex, (wIndex + 1).toString())
        .replace(MARKDOWN_TEMPLATE_TOKEN.word, word.word)
        .replace(MARKDOWN_TEMPLATE_TOKEN.syntacticCategory, word.syntacticCategory)
        .replace(MARKDOWN_TEMPLATE_TOKEN.explanation, word.explanation)
    }, '')
  }
}

export default new Downloader()
