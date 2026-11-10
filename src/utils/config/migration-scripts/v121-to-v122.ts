/**
 * Migration script from v121 to v122
 * - Languages move from ISO 639-3 codes (`cmn`, `por`) to BCP 47 tags
 *   (`zh-Hans`, `pt-BR`) wherever config stores one: `language`,
 *   `translationHub`, `inputTranslation`, `pageTranslation.page`'s
 *   `autoTranslateLanguages` and `skipLanguages`, the keys of
 *   `tts.languageVoices`, and each custom action's `sampleData.targetCode`.
 * - `tts.languageVoices` gains European Portuguese (`pt-PT`).
 *
 * Portuguese has always been translated as Brazilian Portuguese, so `por`
 * becomes `pt-BR` and translations come out as before.
 *
 * Idempotent: a value that is already a tag stays as it is.
 *
 * IMPORTANT: The code table is hardcoded inline. Migration scripts are
 * frozen snapshots - never import constants, helpers, or shared types.
 */

const TAG_BY_CODE: Readonly<Record<string, string>> = {
  eng: "en",
  cmn: "zh-Hans",
  "cmn-Hant": "zh-Hant",
  yue: "yue",
  spa: "es",
  rus: "ru",
  arb: "ar",
  ben: "bn",
  hin: "hi",
  por: "pt-BR",
  ind: "id",
  jpn: "ja",
  fra: "fr",
  deu: "de",
  jav: "jv",
  kor: "ko",
  tel: "te",
  vie: "vi",
  mar: "mr",
  ita: "it",
  tam: "ta",
  tur: "tr",
  urd: "ur",
  guj: "gu",
  pol: "pl",
  ukr: "uk",
  kan: "kn",
  mai: "mai",
  mal: "ml",
  pes: "fa",
  mya: "my",
  swh: "sw",
  sun: "su",
  ron: "ro",
  pan: "pa",
  bho: "bho",
  amh: "am",
  hau: "ha",
  fuv: "ff",
  bos: "bs",
  hrv: "hr",
  nld: "nl",
  srp: "sr",
  tha: "th",
  ckb: "ckb",
  yor: "yo",
  uzn: "uz",
  zlm: "ms",
  ibo: "ig",
  npi: "ne",
  ceb: "ceb",
  skr: "skr",
  tgl: "fil",
  hun: "hu",
  azj: "az",
  sin: "si",
  koi: "koi",
  ell: "el",
  ces: "cs",
  mag: "mag",
  run: "rn",
  bel: "be",
  plt: "mg",
  qug: "qug",
  mad: "mad",
  nya: "ny",
  zyb: "za",
  pbu: "ps",
  kin: "rw",
  zul: "zu",
  bul: "bg",
  swe: "sv",
  lin: "ln",
  som: "so",
  hms: "hms",
  hnj: "hnj",
  ilo: "ilo",
  kaz: "kk",
  heb: "he",
  nob: "nb",
  nno: "nn",
  afr: "af",
  sqi: "sq",
  asm: "as",
  eus: "eu",
  bre: "br",
  cat: "ca",
  cos: "co",
  cym: "cy",
  dan: "da",
  div: "dv",
  epo: "eo",
  ekk: "et",
  fao: "fo",
  fij: "fj",
  fin: "fi",
  fry: "fy",
  gla: "gd",
  gle: "ga",
  glg: "gl",
  grn: "gn",
  hat: "ht",
  haw: "haw",
  hye: "hy",
  ido: "io",
  ina: "ia",
  isl: "is",
  kat: "ka",
  khm: "km",
  kir: "ky",
  lao: "lo",
  lat: "la",
  lvs: "lv",
  lit: "lt",
  ltz: "lb",
  mkd: "mk",
  mlt: "mt",
  mon: "mn",
  mri: "mi",
  nso: "nso",
  oci: "oc",
  ori: "or",
  orm: "om",
  prs: "fa-AF",
  san: "sa",
  slk: "sk",
  slv: "sl",
  smo: "sm",
  sna: "sn",
  snd: "sd",
  sot: "st",
  tah: "ty",
  tat: "tt",
  tgk: "tg",
  tir: "ti",
  ton: "to",
  tsn: "tn",
  tuk: "tk",
  uig: "ug",
  vol: "vo",
  wol: "wo",
  xho: "xh",
  ydd: "yi",
  aka: "ak",
  bam: "bm",
  bis: "bi",
  bod: "bo",
  che: "ce",
  chv: "cv",
  dzo: "dz",
  ewe: "ee",
  kab: "kab",
  lug: "lg",
  oss: "os",
  ssw: "ss",
  ven: "ve",
  war: "war",
  nde: "nd",
  nbl: "nr",
  pam: "pam",
  hil: "hil",
  bcl: "bik",
  min: "min",
  ace: "ace",
  bug: "bug",
  ban: "ban",
  bjn: "bjn",
  mak: "mak",
  sas: "sas",
  tet: "tet",
  cha: "ch",
  niu: "niu",
  tvl: "tvl",
  gil: "gil",
  mah: "mh",
  pau: "pau",
  wls: "wls",
  rar: "rar",
  hif: "hif",
}

const EUROPEAN_PORTUGUESE_VOICE = "pt-PT-DuarteNeural"

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toTag(value: unknown): unknown {
  return typeof value === "string" && Object.hasOwn(TAG_BY_CODE, value) ? TAG_BY_CODE[value] : value
}

function toTags(value: unknown): unknown {
  return Array.isArray(value) ? value.map(toTag) : value
}

// Only the fields a record has: a missing field stays missing.
function withTags(record: Record<string, any>, fields: readonly string[]): Record<string, any> {
  const moved = { ...record }
  for (const field of fields) {
    if (field in moved) moved[field] = toTag(moved[field])
  }
  return moved
}

function migratePage(pageTranslation: unknown): unknown {
  if (!isRecord(pageTranslation) || !isRecord(pageTranslation.page)) return pageTranslation
  const { page } = pageTranslation
  return {
    ...pageTranslation,
    page: {
      ...page,
      autoTranslateLanguages: toTags(page.autoTranslateLanguages),
      skipLanguages: toTags(page.skipLanguages),
    },
  }
}

function migrateTts(tts: unknown): unknown {
  if (!isRecord(tts) || !isRecord(tts.languageVoices)) return tts
  const languageVoices: Record<string, unknown> = Object.fromEntries(
    Object.entries(tts.languageVoices).map(([code, voice]) => [toTag(code), voice]),
  )
  languageVoices["pt-PT"] ??= EUROPEAN_PORTUGUESE_VOICE
  return { ...tts, languageVoices }
}

function migrateCustomActions(selectionToolbar: unknown): unknown {
  if (!isRecord(selectionToolbar) || !Array.isArray(selectionToolbar.customActions)) {
    return selectionToolbar
  }
  return {
    ...selectionToolbar,
    customActions: selectionToolbar.customActions.map((action: unknown) =>
      isRecord(action) && isRecord(action.sampleData)
        ? { ...action, sampleData: withTags(action.sampleData, ["targetCode"]) }
        : action,
    ),
  }
}

export function migrate(oldConfig: any): any {
  if (!isRecord(oldConfig)) return oldConfig

  const config: Record<string, any> = { ...oldConfig }
  if (isRecord(config.language)) {
    config.language = withTags(config.language, ["sourceCode", "targetCode"])
  }
  if (isRecord(config.translationHub)) {
    config.translationHub = withTags(config.translationHub, ["sourceCode", "targetCode"])
  }
  if (isRecord(config.inputTranslation)) {
    // `fromLang` and `toLang` also take "sourceCode" and "targetCode", which
    // name a field rather than a language and are not in the table.
    config.inputTranslation = withTags(config.inputTranslation, ["fromLang", "toLang"])
  }
  if ("pageTranslation" in config) config.pageTranslation = migratePage(config.pageTranslation)
  if ("tts" in config) config.tts = migrateTts(config.tts)
  if ("selectionToolbar" in config) {
    config.selectionToolbar = migrateCustomActions(config.selectionToolbar)
  }
  return config
}
