import type { EntityTable } from "dexie"
import { upperCamelCase } from "case-anything"
import { Dexie } from "dexie"
import { APP_NAME } from "@/utils/constants/app"
import { withStoredTargetLangs } from "@/utils/glossary/sync/merge-document"
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
    // v7 changes no store. A term's `targetLang` moves from the ISO 639-3 code
    // it was written with (`cmn`) to the BCP 47 tag languages are keyed by now
    // (`zh-Hans`); unmoved, every existing term would stop matching. Codes map
    // one to one, but a device that synced with an upgraded one before
    // upgrading itself can already hold a term under both spellings. Moving
    // both onto one [glossaryId+targetLang+matchKey] would abort the upgrade,
    // and the database, every table of it, would then never open, so the older
    // row goes. The sync snapshots keep their codes; the sync reads every side
    // in the stored form (`withStoredTargetLangs`).
    this.version(7)
      .stores({
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
        glossarySyncSnapshot: `
          id`,
      })
      .upgrade(async (tx) => {
        const table = tx.table("glossaryTerm")
        const terms = await table.toArray()
        const kept = withStoredTargetLangs(terms)
        const keptIds = new Set(kept.map((term) => term.id))
        await table.bulkDelete(terms.filter((term) => !keptIds.has(term.id)).map((term) => term.id))
        await table.bulkPut(kept)
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
