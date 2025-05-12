import { z } from "zod";

import { langCodeISO6393 } from "./config/languages";

export type ExtractedContent = {
  article: {
    title?: string | null | undefined;
    byline?: string | null | undefined;
    dir?: string | null | undefined;
    content?: Node | null | undefined;
    textContent?: string | null | undefined;
    length?: number | null | undefined;
    excerpt?: string | null | undefined;
    siteName?: string | null | undefined;
    lang: string | null | undefined;
  };
  paragraphs: string[];
};

export const articleAnalysisSchema = z.object({
  isArticle: z.boolean(),
  detectedLang: langCodeISO6393.or(z.literal("und")),
  summary: z.string(),
  introduction: z.string(),
  terms: z.array(z.string()),
});

export const partOfSpeechAbbr = z.enum([
  "n.", // noun
  "pron.", // pronoun
  "v.", // verb
  "adj.", // adjective
  "adv.", // adverb
  "prep.", // preposition
  "conj.", // conjunction
  "interj.", // interjection
  "det.", // determiner
  "num.", // numeral
  "part.", // particle
]);

export const syntacticCategoryAbbr = partOfSpeechAbbr.or(z.enum(["ph."]));

export const articleExplanationSchema = z.object({
  paragraphs: z.array(
    z.array(
      z.object({
        originalSentence: z.string(),
        translatedSentence: z.string(),
        words: z.array(
          z.object({
            word: z.string(),
            syntacticCategory: syntacticCategoryAbbr,
            explanation: z.string(),
          }),
        ),
        explanation: z.string(),
      }),
    ),
  ),
});

export type ArticleAnalysis = z.infer<typeof articleAnalysisSchema>;
export type ArticleExplanation = z.infer<typeof articleExplanationSchema>;
export type SyntacticCategoryAbbr = z.infer<typeof syntacticCategoryAbbr>;
