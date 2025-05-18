import type { Config } from '@/types/config/config'
import type {
  ArticleAnalysis,
  ArticleExplanation,
  ExtractedContent,
} from '@/types/content'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { generateObject } from 'ai'

import { useAtomValue, useSetAtom } from 'jotai'
import { toast } from 'sonner'
import {
  progressAtom,
  readStateAtom,
  store,
} from '@/entrypoints/side.content/atoms'
import { langCodeToEnglishName } from '@/types/config/languages'
import {
  articleAnalysisSchema,
  articleExplanationSchema,
} from '@/types/content'
import { configAtom, configFields } from '@/utils/atoms/config'
import { isAnyAPIKey } from '@/utils/config/config'
import { getAnalyzePrompt } from '@/utils/prompts/analyze'
import { getExplainPrompt } from '@/utils/prompts/explain'
import { getTranslateModel as getReadModel } from '@/utils/provider'

interface ExplainArticleParams {
  extractedContent: ExtractedContent
  articleAnalysis: ArticleAnalysis
}

const MAX_ATTEMPTS = 3
const MAX_CHARACTERS = 1000

export function useAnalyzeContent() {
  const setReadState = useSetAtom(readStateAtom)
  const { language, read } = useAtomValue(configAtom)
  const setLanguage = useSetAtom(configFields.language)
  return useMutation<ArticleAnalysis, Error, ExtractedContent>({
    mutationKey: ['analyzeContent'],
    mutationFn: async (extractedContent: ExtractedContent) => {
      if (!extractedContent.paragraphs.length) {
        throw new Error('No content available for summary generation')
      }

      setReadState('analyzing')
      let attempts = 0
      const maxAttempts = 3
      let lastError

      const modelConfig = read.models[read.provider]
      const modelString = modelConfig.isCustomModel ? modelConfig.customModel : modelConfig.model
      if (!modelString) {
        throw new Error('No model string available for summary generation')
      }
      const model = await getReadModel(read.provider, modelString)
      const targetLang = langCodeToEnglishName[language.targetCode]

      while (attempts < maxAttempts) {
        try {
          const { object: articleAnalysis } = await generateObject({
            model,
            system: getAnalyzePrompt(targetLang),
            prompt: JSON.stringify({
              originalTitle: extractedContent.article.title,
              content: extractedContent.paragraphs.join('\n'),
            }),
            schema: articleAnalysisSchema,
          })

          // TODO: if und, then UI need to show UI to ask user to select the language or not continue
          setLanguage({
            detectedCode:
              articleAnalysis.detectedLang === 'und'
                ? 'cmn'
                : articleAnalysis.detectedLang,
          })
          logger.log('articleAnalysis', articleAnalysis)

          return articleAnalysis
        }
        catch (error) {
          lastError = error
          attempts++

          logger.error(
            `error when attempt ${attempts} to analyze content`,
            error,
          )
        }
      }

      throw lastError
    },
    onError: () => {
      setReadState(undefined)
    },
  })
}

async function explainBatch(batch: string[], articleAnalysis: ArticleAnalysis, config: Config) {
  let attempts = 0
  let lastError

  const { language, read } = config

  const targetLang = langCodeToEnglishName[language.targetCode]
  const sourceLang
    = langCodeToEnglishName[
      language.sourceCode === 'auto'
        ? language.detectedCode
        : language.sourceCode
    ]

  const modelConfig = read.models[read.provider]
  const modelString = modelConfig.isCustomModel ? modelConfig.customModel : modelConfig.model

  if (!modelString) {
    throw new Error('No model string available for explanation generation')
  }

  const model = await getReadModel(read.provider, modelString)
  while (attempts < MAX_ATTEMPTS) {
    try {
      const { object: articleExplanation } = await generateObject({
        model,
        system: getExplainPrompt(
          sourceLang,
          targetLang,
          language.level ?? 'intermediate',
        ),
        prompt: JSON.stringify({
          overallSummary: articleAnalysis.summary,
          paragraphs: batch,
        }),
        schema: articleExplanationSchema,
      })

      store.set(progressAtom, prev => ({
        ...prev,
        completed: prev.completed + 1,
      }))

      logger.log('articleExplanation', articleExplanation)

      return articleExplanation
    }
    catch (error) {
      lastError = error
      attempts++

      logger.error(
        `error when attempt ${attempts} to explain batch`,
        batch,
        error,
      )
    }
  }

  throw lastError
}

export function useExplainArticle() {
  const setReadState = useSetAtom(readStateAtom)
  const config = useAtomValue(configAtom)
  return useMutation<
    ArticleExplanation['paragraphs'],
    Error,
    ExplainArticleParams
  >({
    mutationKey: ['explainArticle'],
    mutationFn: async (params: ExplainArticleParams) => {
      const { extractedContent, articleAnalysis } = params
      if (!extractedContent?.paragraphs.length || !articleAnalysis) {
        throw new Error(
          'No content or summary available for explanation generation',
        )
      }
      setReadState('explaining')
      // Process paragraphs in batches of 3
      const paragraphs = extractedContent.paragraphs
      const batches = []

      // if cur > 1200 or prev + cur > 1200, then push prev to batches, clear prev
      // if cur > 1200, push the cur to batches
      // else push cur to prev
      // last push prev to batches

      let prevParagraphs: string[] = []
      let prevParagraphsLength = 0
      for (let i = 0; i < paragraphs.length; i++) {
        if (prevParagraphsLength + paragraphs[i].length > MAX_CHARACTERS) {
          batches.push(prevParagraphs)
          prevParagraphs = []
          prevParagraphsLength = 0
        }
        if (paragraphs[i].length > MAX_CHARACTERS) {
          batches.push([paragraphs[i]])
        }
        else {
          prevParagraphs.push(paragraphs[i])
          prevParagraphsLength += paragraphs[i].length
        }
      }
      if (prevParagraphs.length > 0) {
        batches.push(prevParagraphs)
      }

      store.set(progressAtom, {
        completed: 0,
        total: batches.length,
      })

      logger.log('batches length', batches.length)
      logger.log('batches', batches)

      const allParagraphExplanations = await sendInBatchesWithFixedDelay(
        batches.map(batch => explainBatch(batch, articleAnalysis, config)),
      )

      const flattenedParagraphExplanations = allParagraphExplanations
        .map(explanation => explanation.paragraphs)
        .flat()

      setReadState(undefined)

      return flattenedParagraphExplanations
    },
    onError: () => {
      setReadState(undefined)
    },
  })
}

export function useReadArticle() {
  const analyzeContent = useAnalyzeContent()
  const explainArticle = useExplainArticle()
  const setReadState = useSetAtom(readStateAtom)
  const queryClient = useQueryClient()
  const providersConfig = useAtomValue(configFields.providersConfig)

  const mutate = async () => {
    if (!isAnyAPIKey(providersConfig)) {
      toast.error(i18n.t('noConfig.warning'))
      return
    }
    // Reset explainArticle data before starting a new read operation
    explainArticle.reset()

    // Remove previous mutations from the cache to clear useMutationState data
    queryClient.getMutationCache().clear()

    setReadState('extracting')

    try {
      // Re-trigger extract query and wait for the result
      const freshData = await queryClient.fetchQuery<ExtractedContent>({
        queryKey: ['extractContent'],
        staleTime: 0,
      })

      if (!freshData) {
        setReadState(undefined)
        throw new Error('Failed to extract content')
      }

      logger.log('freshExtractedContent', freshData)

      const articleAnalysis = await analyzeContent.mutateAsync(freshData)
      setReadState('continue?')
      if (articleAnalysis.isArticle) {
        await explainArticle.mutateAsync({
          extractedContent: freshData,
          articleAnalysis,
        })
      }
    }
    catch (error) {
      logger.error('Error during content extraction or analysis', error)
      setReadState(undefined)
      throw error
    }
  }

  return {
    mutate,
    analyzeContent,
    explainArticle,
  }
}
