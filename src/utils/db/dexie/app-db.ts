import type { EntityTable } from "dexie"
import { upperCamelCase } from "case-anything"
import { Dexie } from "dexie"
import { APP_NAME } from "@/utils/constants/app"
import AiSegmentationCache from "./tables/ai-segmentation-cache"
import ArticleSummaryCache from "./tables/article-summary-cache"
import BatchRequestRecord from "./tables/batch-request-record"
import Glossary from "./tables/glossary"
import GlossarySyncSnapshot from "./tables/glossary-sync-snapshot"
import GlossaryTerm from "./tables/glossary-term"
import TranslationCache from "./tables/translation-cache"

export default class AppDB extends Dexie {
  translationCache!: EntityTable<TranslationCache, "key">

  batchRequestRecord!: EntityTable<BatchRequestRecord, "key">

  articleSummaryCache!: EntityTable<ArticleSummaryCache, "key">

  aiSegmentationCache!: EntityTable<AiSegmentationCache, "key">

  glossary!: EntityTable<Glossary, "id">

  glossaryTerm!: EntityTable<GlossaryTerm, "id">

  glossarySyncSnapshot!: EntityTable<GlossarySyncSnapshot, "id">

  constructor() {
    super(`${upperCamelCase(APP_NAME)}DB`)
    this.version(1).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
    })
    this.version(2).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
      batchRequestRecord: `
        key,
        createdAt,
        originalRequestCount,
        provider,
        model`,
    })
    this.version(3).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
      batchRequestRecord: `
        key,
        createdAt,
        originalRequestCount,
        provider,
        model`,
      articleSummaryCache: `
        key,
        createdAt`,
    })
    this.version(4).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
      batchRequestRecord: `
        key,
        createdAt,
        originalRequestCount,
        provider,
        model`,
      articleSummaryCache: `
        key,
        createdAt`,
      aiSegmentationCache: `
        key,
        createdAt`,
    })
    // v5 adds the user glossary. Dexie requires every version to restate the
    // full store set, so the four cache tables are repeated verbatim.
    //
    // `glossaryTerm.matchKey` is unique per GLOSSARY AND TARGET LANGUAGE, not
    // per table: two glossaries may give the same term different wording (the
    // merge in `utils/glossary/scope.ts` chooses), and one glossary may render
    // the same term differently per language (only one language is ever in
    // play, so nothing has to choose).
    this.version(5).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
      batchRequestRecord: `
        key,
        createdAt,
        originalRequestCount,
        provider,
        model`,
      articleSummaryCache: `
        key,
        createdAt`,
      aiSegmentationCache: `
        key,
        createdAt`,
      glossary: `
        id,
        enabled,
        createdAt`,
      glossaryTerm: `
        id,
        glossaryId,
        &[glossaryId+targetLang+matchKey],
        enabled,
        updatedAt`,
    })
    // v6 adds the Drive sync's two local snapshots. A new store needs no
    // upgrade function — Dexie creates it — but every version must still restate
    // the full store set, so the six above are repeated verbatim.
    //
    // A separate version rather than an edit to v5: the glossary is on `main`,
    // so a release could already carry v5 to someone's browser, and rewriting a
    // shipped version in place is how a database ends up disagreeing with itself
    // about what it contains.
    this.version(6).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
      batchRequestRecord: `
        key,
        createdAt,
        originalRequestCount,
        provider,
        model`,
      articleSummaryCache: `
        key,
        createdAt`,
      aiSegmentationCache: `
        key,
        createdAt`,
      glossary: `
        id,
        enabled,
        createdAt`,
      glossaryTerm: `
        id,
        glossaryId,
        &[glossaryId+targetLang+matchKey],
        enabled,
        updatedAt`,
      // Two rows, under two fixed ids, each holding a whole glossary. Nothing
      // queries them by anything but the id.
      glossarySyncSnapshot: `
        id`,
    })
    this.translationCache.mapToClass(TranslationCache)
    this.batchRequestRecord.mapToClass(BatchRequestRecord)
    this.articleSummaryCache.mapToClass(ArticleSummaryCache)
    this.aiSegmentationCache.mapToClass(AiSegmentationCache)
    this.glossary.mapToClass(Glossary)
    this.glossaryTerm.mapToClass(GlossaryTerm)
    this.glossarySyncSnapshot.mapToClass(GlossarySyncSnapshot)
  }
}
