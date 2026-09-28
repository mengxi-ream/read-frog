import type { LangCodeISO6393 } from "@read-frog/definitions"
import type {
  DictionarySlot,
  ImproveWritingSlot,
  SentenceAnalysisSlot,
} from "@read-frog/layout-engine/presets"
import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import type { SupportedUiLocale } from "@/utils/i18n/locales"
import { DEFAULT_UI_LOCALE } from "@/utils/i18n/locales"
import { langCodeOfLocale } from "./labels"
import {
  getDictionarySlots,
  getImproveWritingSlots,
  getSentenceAnalysisSlots,
  isImproveWritingShaped,
  isSentenceAnalysisShaped,
} from "./slots"

// Sample results for the layout preview on the options page. Values are keyed
// by field NAME, the shape a model's structured output has; user edits to the
// samples are keyed by field id so they survive a rename.
//
// Samples are answers written in a language the extension has words in, keyed
// by that language's UI locale: the preview picks the one in the reader's
// language (see contentLocaleFor), whose target language is the locale's own.

// A worked Dictionary answer per language, so the preview reads like a lookup
// by someone who reads that language: an English word explained in it, or, in
// English, a Chinese word explained in English.
interface DictionarySample {
  selection: string
  values: Record<DictionarySlot, string>
}

function englishWordSample(definition: string, contextTranslation: string): DictionarySample {
  return {
    selection: "blossoms",
    values: {
      term: "blossom",
      phonetic: "/ˈblɒs.əm/",
      partOfSpeech: "noun",
      definition,
      context: "The ephemeral beauty of cherry blossoms reminds us to cherish each moment.",
      contextTerm: '[{"text":"blossoms"}]',
      contextTranslation,
      difficulty: "B2",
    },
  }
}

const DICTIONARY_SAMPLES: Record<SupportedUiLocale, DictionarySample> = {
  en: {
    selection: "珍惜",
    values: {
      term: "珍惜",
      phonetic: "zhēnxī",
      partOfSpeech: "verb",
      definition: "to cherish; to treasure; to value highly",
      context: "樱花短暂的美丽提醒我们珍惜每一刻。",
      contextTerm: '[{"text":"珍惜"}]',
      contextTranslation:
        "The fleeting beauty of cherry blossoms reminds us to cherish every moment.",
      difficulty: "B1",
    },
  },
  "zh-CN": englishWordSample("花；花朵（尤指果树的花）", "樱花短暂的美丽提醒我们珍惜每一刻。"),
  "zh-TW": englishWordSample("花；花朵（尤指果樹的花）", "櫻花短暫的美麗提醒我們珍惜每一刻。"),
  ja: englishWordSample(
    "花（特に果樹の花）",
    "桜のはかない美しさは、一瞬一瞬を大切にするよう私たちに思い出させてくれる。",
  ),
  ko: englishWordSample(
    "꽃 (특히 과일나무의 꽃)",
    "벚꽃의 덧없는 아름다움은 매 순간을 소중히 여기라고 우리에게 일깨워 준다.",
  ),
  ru: englishWordSample(
    "цветок; цветение (особенно плодовых деревьев)",
    "Мимолётная красота цветущей вишни напоминает нам ценить каждое мгновение.",
  ),
  tr: englishWordSample(
    "çiçek (özellikle meyve ağaçlarının çiçeği)",
    "Kiraz çiçeklerinin geçici güzelliği bize her anın kıymetini bilmemizi hatırlatır.",
  ),
  vi: englishWordSample(
    "hoa (đặc biệt là hoa của cây ăn quả)",
    "Vẻ đẹp phù du của hoa anh đào nhắc nhở chúng ta trân trọng từng khoảnh khắc.",
  ),
  es: englishWordSample(
    "flor (especialmente la de un árbol frutal)",
    "La belleza efímera de los cerezos en flor nos recuerda valorar cada momento.",
  ),
  az: englishWordSample(
    "çiçək (xüsusilə meyvə ağacının çiçəyi)",
    "Albalı çiçəklərinin ötəri gözəlliyi bizə hər anın qədrini bilməyi xatırladır.",
  ),
}

// The locale of the samples for `locale`: itself when there are samples in
// it, else the default one.
function sampleLocaleFor(locale: string | undefined): SupportedUiLocale {
  return locale !== undefined && Object.hasOwn(DICTIONARY_SAMPLES, locale)
    ? (locale as SupportedUiLocale)
    : DEFAULT_UI_LOCALE
}

// A Sentence Analysis answer per language, the same way round as the
// dictionary's: an English sentence explained in that language, or, in
// English, a Chinese sentence explained in English. The annotations are real
// answers to the built-in prompt (gpt-6-luna for the English sentence,
// deepseek-chat for the Chinese one, the modified word of an attributive added
// from another model's answer), with notes written in so the preview shows
// them; models add a note only when the keys cannot say it. They travel as a
// compact JSON array inside a string, like a model writes them, which the
// preview's replay streams in a chunk at a time.
interface SentenceAnalysisSample {
  selection: string
  values: Record<SentenceAnalysisSlot, string>
}

interface SentenceAnalysisAnnotation {
  text: string
  type: string
  form?: string
  sense?: string
  head?: string
  obstacle?: string
  restore?: string
  note?: string
}

function sentenceAnalysisValues(
  annotations: SentenceAnalysisAnnotation[],
  translation: string,
): Record<SentenceAnalysisSlot, string> {
  return { annotations: JSON.stringify(annotations), translation }
}

const ENGLISH_SENTENCE =
  "The committee has postponed the decision which was expected last week, citing concerns that the proposal, if implemented hastily, could undermine public trust."

// `notes`: why the committee postponed; where the subject's verb is.
function englishSentenceSample(
  notes: [reason: string, verb: string],
  translation: string,
): SentenceAnalysisSample {
  return {
    selection: ENGLISH_SENTENCE,
    values: sentenceAnalysisValues(
      [
        { text: "The committee", type: "subject" },
        { text: "has postponed", type: "predicate" },
        { text: "the decision which was expected last week", type: "object" },
        {
          text: "which was expected last week",
          type: "attributive",
          form: "clause",
          head: "decision",
        },
        { text: "which", type: "connector" },
        { text: "was expected", type: "predicate", obstacle: "passive" },
        { text: "last week", type: "adverbial" },
        {
          text: "citing concerns that the proposal, if implemented hastily, could undermine public trust",
          type: "adverbial",
          form: "present-participle",
          sense: "cause",
          note: notes[0],
        },
        { text: "concerns", type: "object" },
        {
          text: "that the proposal, if implemented hastily, could undermine public trust",
          type: "appositive",
          form: "clause",
          head: "concerns",
        },
        { text: "that", type: "connector" },
        { text: "the proposal", type: "subject", note: notes[1] },
        {
          text: "if implemented hastily",
          type: "adverbial",
          form: "clause",
          sense: "condition",
          obstacle: "ellipsis",
          restore: "if the proposal is implemented hastily",
        },
        { text: "if", type: "connector" },
        { text: "implemented", type: "predicate", obstacle: "passive" },
        { text: "could undermine", type: "predicate" },
        { text: "public trust", type: "object" },
      ],
      translation,
    ),
  }
}

const SENTENCE_ANALYSIS_SAMPLES: Record<SupportedUiLocale, SentenceAnalysisSample> = {
  en: {
    selection: "虽然这个方案成本很高，但大多数专家认为它是解决城市交通拥堵的唯一办法。",
    values: sentenceAnalysisValues(
      [
        { text: "虽然这个方案成本很高", type: "adverbial", form: "clause", sense: "concession" },
        { text: "虽然", type: "connector" },
        { text: "这个方案", type: "subject" },
        {
          text: "成本很高",
          type: "predicate",
          note: "A subject and predicate acting as the predicate",
        },
        { text: "但", type: "connector", note: "Pairs with 虽然; English keeps only one" },
        { text: "大多数专家", type: "subject" },
        { text: "认为", type: "predicate" },
        { text: "它是解决城市交通拥堵的唯一办法", type: "object", form: "clause", head: "认为" },
        { text: "它", type: "subject" },
        { text: "是", type: "predicate" },
        { text: "解决城市交通拥堵的唯一办法", type: "complement" },
        { text: "解决城市交通拥堵的", type: "attributive", head: "办法" },
      ],
      "Although this plan is very costly, most experts believe it is the only way to solve urban traffic congestion.",
    ),
  },
  "zh-CN": englishSentenceSample(
    ["说明推迟的理由", "它的谓语是插入语后面的 could undermine"],
    "委员会推迟了原定于上周做出的决定，理由是担心该提案如果仓促实施，可能会损害公众信任。",
  ),
  "zh-TW": englishSentenceSample(
    ["說明延後的理由", "它的述語是插入語後面的 could undermine"],
    "委員會延後了原定於上週做出的決定，理由是擔心該提案若倉促實施，可能會損害公眾信任。",
  ),
  ja: englishSentenceSample(
    ["延期の理由を示す", "述語は挿入句の後の could undermine"],
    "委員会は、提案を性急に実施すれば国民の信頼を損ないかねないとの懸念を理由に、先週予定されていた決定を延期した。",
  ),
  ko: englishSentenceSample(
    ["연기한 이유를 밝힘", "서술어는 삽입구 뒤의 could undermine"],
    "위원회는 제안이 성급하게 시행되면 대중의 신뢰를 훼손할 수 있다는 우려를 들어 지난주로 예정되었던 결정을 연기했다.",
  ),
  ru: englishSentenceSample(
    ["Объясняет причину отсрочки", "Его сказуемое — could undermine после вставки"],
    "Комитет отложил решение, которого ожидали на прошлой неделе, сославшись на опасения, что предложение, если его поспешно реализовать, может подорвать доверие общества.",
  ),
  tr: englishSentenceSample(
    ["Ertelemenin gerekçesini verir", "Yüklemi ara sözden sonraki could undermine"],
    "Komite, teklifin aceleyle uygulanması halinde kamuoyunun güvenini sarsabileceği endişesini gerekçe göstererek geçen hafta beklenen kararı erteledi.",
  ),
  vi: englishSentenceSample(
    ["Nêu lý do hoãn quyết định", "Vị ngữ của nó là could undermine sau phần chèn"],
    "Ủy ban đã hoãn quyết định vốn được chờ đợi từ tuần trước, viện dẫn lo ngại rằng đề xuất này, nếu được thực thi vội vàng, có thể làm suy giảm lòng tin của công chúng.",
  ),
  es: englishSentenceSample(
    ["Da el motivo del aplazamiento", "Su verbo es could undermine, tras el inciso"],
    "El comité ha aplazado la decisión que se esperaba la semana pasada, alegando la preocupación de que la propuesta, si se aplica con prisas, podría socavar la confianza pública.",
  ),
  az: englishSentenceSample(
    ["Təxirə salmanın səbəbini göstərir", "Onun xəbəri ara sözdən sonrakı could undermine-dir"],
    "Komitə təklifin tələsik həyata keçirilərsə ictimai etimadı sarsıda biləcəyi ilə bağlı narahatlıqları əsas gətirərək keçən həftə gözlənilən qərarı təxirə saldı.",
  ),
}

// An Improve Writing answer per language, the same way round as the others:
// an English email to a professor marked in that language, or, in English, a
// Chinese learner's sentence marked in English. Each shows every tier — an
// error with a short fix written between the lines, an awkward phrase whose
// longer fix leaves a pen mark, a choice worth keeping — and the setting the
// marks are judged against.
interface ImproveWritingSample {
  selection: string
  values: Record<ImproveWritingSlot, string>
}

interface ImproveWritingMark {
  text: string
  fix?: string
  type: string
  tag?: string
  note: string
}

const ENGLISH_EMAIL =
  "Dear Professor Lee, I want to know if you are free tomorrow. I have some questions about the homework and hope you can explain me."

// The email's marks and summary in one language: the greeting that works,
// the request's tone, and explain's object.
function englishEmailSample(words: {
  setting: string
  greeting: string
  toneTag: string
  tone: string
  explain: string
  summary: string
}): ImproveWritingSample {
  const marks: ImproveWritingMark[] = [
    { text: "Dear Professor Lee,", type: "good", note: words.greeting },
    {
      text: "I want to know if you are free tomorrow",
      fix: "I was wondering if you might be free tomorrow",
      type: "register",
      tag: words.toneTag,
      note: words.tone,
    },
    {
      text: "explain me",
      fix: "explain them to me",
      type: "grammar",
      tag: "explain",
      note: words.explain,
    },
  ]
  return {
    selection: ENGLISH_EMAIL,
    values: {
      setting: words.setting,
      annotations: JSON.stringify(marks),
      improved:
        "Dear Professor Lee, I was wondering if you might be free tomorrow. I have some questions about the homework and hope you can explain them to me.",
      summary: words.summary,
    },
  }
}

const IMPROVE_WRITING_SAMPLES: Record<SupportedUiLocale, ImproveWritingSample> = {
  en: {
    selection: "我昨天去商店想买三个书，可是我没有带钱，所以我不买了。",
    values: {
      setting: "Casual · practice chat",
      annotations: JSON.stringify([
        {
          text: "去商店想买",
          type: "good",
          note: "Natural serial verbs: go somewhere to do something.",
        },
        {
          text: "三个书",
          fix: "三本书",
          type: "grammar",
          tag: "measure",
          note: "Books take the measure word 本, not the generic 个.",
        },
        {
          text: "可是我没有带钱",
          fix: "结果忘了带钱",
          type: "unnatural",
          tag: "结果",
          note: "结果 tells how it turned out; 忘了带钱 says what happened.",
        },
        {
          text: "所以我不买了",
          fix: "就没买成",
          type: "grammar",
          tag: "不 vs 没",
          note: "Negate past events with 没; 没买成 means you couldn't buy them.",
        },
      ] satisfies ImproveWritingMark[]),
      improved: "我昨天去商店想买三本书，结果忘了带钱，就没买成。",
      summary: "Clear meaning; watch the measure word and 没 for the past.",
    },
  },
  "zh-CN": englishEmailSample({
    setting: "正式 · 写给教授的邮件",
    greeting: "称呼得体：Professor + 姓",
    toneTag: "语气",
    tone: "对教授直接说 I want 显得生硬，I was wondering 更委婉",
    explain: "explain 不直接接人：explain sth to sb",
    summary: "称呼得体，但请求的语气对教授来说有点生硬。",
  }),
  "zh-TW": englishEmailSample({
    setting: "正式 · 寫給教授的郵件",
    greeting: "稱呼得體：Professor + 姓",
    toneTag: "語氣",
    tone: "對教授直接說 I want 顯得生硬，I was wondering 更委婉",
    explain: "explain 不直接接人：explain sth to sb",
    summary: "稱呼得體，但請求的語氣對教授來說有點生硬。",
  }),
  ja: englishEmailSample({
    setting: "フォーマル · 教授へのメール",
    greeting: "Professor + 姓の呼びかけは適切",
    toneTag: "語調",
    tone: "教授に I want は直接的すぎる。I was wondering の方が丁寧",
    explain: "explain は人を直接目的語にしない：explain sth to sb",
    summary: "呼びかけは適切だが、依頼の口調が教授には少し直接的すぎる。",
  }),
  ko: englishEmailSample({
    setting: "격식 · 교수님께 보내는 메일",
    greeting: "Professor + 성으로 부른 호칭이 적절해요",
    toneTag: "어조",
    tone: "교수님께 I want는 너무 직접적이에요. I was wondering이 더 공손해요",
    explain: "explain 뒤에 사람을 바로 쓰지 않아요: explain sth to sb",
    summary: "호칭은 적절하지만 부탁하는 어조가 교수님께는 조금 딱딱해요.",
  }),
  ru: englishEmailSample({
    setting: "Официально · письмо профессору",
    greeting: "Уместное обращение: Professor + фамилия",
    toneTag: "тон",
    tone: "I want звучит резко для профессора; I was wondering вежливее",
    explain: "После explain не ставят человека: explain sth to sb",
    summary: "Обращение уместное, но просьба звучит для профессора резковато.",
  }),
  tr: englishEmailSample({
    setting: "Resmî · hocaya e-posta",
    greeting: "Uygun hitap: Professor + soyadı",
    toneTag: "ton",
    tone: "Hocaya I want fazla doğrudan; I was wondering daha kibar",
    explain: "explain doğrudan kişi almaz: explain sth to sb",
    summary: "Hitap uygun, ama rica bir hoca için biraz fazla doğrudan.",
  }),
  vi: englishEmailSample({
    setting: "Trang trọng · email gửi giáo sư",
    greeting: "Cách xưng hô phù hợp: Professor + họ",
    toneTag: "giọng",
    tone: "Nói I want với giáo sư hơi thẳng; I was wondering lịch sự hơn",
    explain: "explain không đi thẳng với người: explain sth to sb",
    summary: "Xưng hô phù hợp, nhưng lời nhờ hơi thẳng với một giáo sư.",
  }),
  es: englishEmailSample({
    setting: "Formal · correo a un profesor",
    greeting: "Saludo adecuado: Professor + apellido",
    toneTag: "tono",
    tone: "I want suena brusco con un profesor; I was wondering es más cortés",
    explain: "explain no lleva a la persona directa: explain sth to sb",
    summary: "El saludo es adecuado, pero la petición suena algo brusca para un profesor.",
  }),
  az: englishEmailSample({
    setting: "Rəsmi · professora məktub",
    greeting: "Uyğun müraciət: Professor + soyad",
    toneTag: "ton",
    tone: "Professora I want çox birbaşadır; I was wondering daha nəzakətlidir",
    explain: "explain şəxsi birbaşa qəbul etmir: explain sth to sb",
    summary: "Müraciət uyğundur, amma xahiş professor üçün bir az kəskin səslənir.",
  }),
}

export const LAYOUT_SAMPLE_NUMBER = 3

// The selection and target language the preview renders with: those of the
// sentence-analysis sample for a sentence-analysis-shaped action, of the
// Improve Writing sample for an Improve-Writing-shaped one, else of the
// dictionary sample, written in `locale`.
export function getLayoutSampleContext(
  outputSchema: SelectionToolbarCustomActionOutputField[],
  locale?: string,
): { selection: string; targetCode: LangCodeISO6393 } {
  const sampleLocale = sampleLocaleFor(locale)
  const { selection } = isSentenceAnalysisShaped(outputSchema)
    ? SENTENCE_ANALYSIS_SAMPLES[sampleLocale]
    : isImproveWritingShaped(outputSchema)
      ? IMPROVE_WRITING_SAMPLES[sampleLocale]
      : DICTIONARY_SAMPLES[sampleLocale]
  return { selection, targetCode: langCodeOfLocale(sampleLocale) }
}

export interface LayoutSampleOptions {
  // The language the sample answers are written in, as a UI locale (see
  // contentLocaleFor); defaults to the default UI language.
  locale?: string
  // Text for a string field with no curated sample; defaults to the name.
  placeholder?: (field: SelectionToolbarCustomActionOutputField) => string
  // Edited samples by field id. Kept as typed text: a number field's text is
  // converted (or kept as written when not numeric) by the layout scope, like
  // a model answer would be.
  overrides?: Readonly<Record<string, string>>
}

export function buildLayoutSampleValues(
  outputSchema: SelectionToolbarCustomActionOutputField[],
  options: LayoutSampleOptions = {},
): Record<string, string | number> {
  // Curated text by field id, for the fields a generated card places.
  const curatedByFieldId = new Map<string, string>()
  const sampleLocale = sampleLocaleFor(options.locale)
  const dictionarySample = DICTIONARY_SAMPLES[sampleLocale]
  for (const [slot, field] of Object.entries(getDictionarySlots(outputSchema))) {
    if (field) curatedByFieldId.set(field.id, dictionarySample.values[slot as DictionarySlot])
  }
  const sentenceAnalysisSample = SENTENCE_ANALYSIS_SAMPLES[sampleLocale]
  for (const [slot, field] of Object.entries(getSentenceAnalysisSlots(outputSchema))) {
    if (field) {
      curatedByFieldId.set(field.id, sentenceAnalysisSample.values[slot as SentenceAnalysisSlot])
    }
  }
  const improveWritingSample = IMPROVE_WRITING_SAMPLES[sampleLocale]
  for (const [slot, field] of Object.entries(getImproveWritingSlots(outputSchema))) {
    if (field) {
      curatedByFieldId.set(field.id, improveWritingSample.values[slot as ImproveWritingSlot])
    }
  }

  const values: Record<string, string | number> = {}
  for (const field of outputSchema) {
    const override = options.overrides?.[field.id]
    const curated = curatedByFieldId.get(field.id)
    let value: string | number
    if (override !== undefined) value = override
    else if (field.type === "number") value = LAYOUT_SAMPLE_NUMBER
    else if (curated !== undefined) value = curated
    else value = options.placeholder?.(field) ?? field.name
    // defineProperty: a field named `__proto__` must stay an own key.
    Object.defineProperty(values, field.name, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    })
  }
  return values
}

// The partial results a stream would deliver on the way to `values`: fields
// arrive in schema order, strings grow a chunk at a time (never splitting a
// surrogate pair), and every frame extends the one before it. Starts with {}
// (everything pending) and ends with the complete values.
export function buildStreamingFrames(
  values: Readonly<Record<string, unknown>>,
  outputSchema: SelectionToolbarCustomActionOutputField[],
  options: { maxFrames?: number } = {},
): Array<Record<string, unknown>> {
  const entries: Array<[name: string, value: unknown]> = []
  const seen = new Set<string>()
  for (const field of outputSchema) {
    if (seen.has(field.name) || !Object.hasOwn(values, field.name)) continue
    seen.add(field.name)
    entries.push([field.name, values[field.name]])
  }

  const totalChars = entries.reduce(
    (sum, [, value]) => sum + (typeof value === "string" ? Array.from(value).length : 0),
    0,
  )
  const step = Math.max(1, Math.ceil(totalChars / Math.max(1, options.maxFrames ?? 60)))

  const frames: Array<Record<string, unknown>> = [{}]
  let current: Record<string, unknown> = {}
  const push = (name: string, value: unknown) => {
    current = { ...current }
    Object.defineProperty(current, name, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    })
    frames.push(current)
  }

  for (const [name, value] of entries) {
    if (typeof value !== "string" || value === "") {
      push(name, value)
      continue
    }
    const chars = Array.from(value)
    for (let end = step; ; end += step) {
      push(name, chars.slice(0, Math.min(end, chars.length)).join(""))
      if (end >= chars.length) break
    }
  }
  return frames
}
