import type { ContentScriptContext } from "#imports"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { defineContentScript } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { streamBackgroundStructuredObject } from "@/utils/content-script/background-stream-client"
import { getOrCreateWebPageContext } from "@/utils/host/translate/webpage-context"
import { sendMessage } from "@/utils/message"
import { resolveModelId } from "@/utils/providers/model-id"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { getTopLevelReasoning } from "@/utils/providers/reasoning"
import {
  findCandidateWords,
  type VocabularyLevel,
  type VocabularyStatus,
} from "@/utils/vocabulary-hunter/candidates"
import {
  getVocabularyLevel,
  loadVocabularyDictionary,
} from "@/utils/vocabulary-hunter/dictionary-data"
import { lookupEmbeddedDictionary } from "@/utils/vocabulary-hunter/dictionary-lookup"
import {
  getVocabularyHunterState,
  setVocabularyHunterState,
  type VocabularyHunterState,
  type VocabularyDictionary,
  watchVocabularyHunterState,
} from "@/utils/vocabulary-hunter/storage"
import { mergeKnownWordsFromSync, syncKnownWord } from "@/utils/vocabulary-hunter/sync"
import {
  buildSelectionToolbarCustomActionSystemPrompt,
  replaceSelectionToolbarCustomActionPromptTokens,
} from "../selection.content/selection-toolbar/custom-action-prompt"

const UNKNOWN_HIGHLIGHT = "read-frog-vocabulary-unknown"
const FUZZY_HIGHLIGHT = "read-frog-vocabulary-fuzzy"
const MAX_RANGES = 1200
const INVALID_TAGS = new Set([
  "BUTTON",
  "CANVAS",
  "CODE",
  "INPUT",
  "KBD",
  "NOSCRIPT",
  "OPTION",
  "PRE",
  "SCRIPT",
  "SELECT",
  "STYLE",
  "SVG",
  "TEXTAREA",
])

interface TrackedRange {
  range: Range
  word: string
  level?: VocabularyLevel
}

function isTextNodeEligible(node: Text, uiHost: HTMLElement) {
  const parent = node.parentElement
  if (!parent || !node.data.trim()) return false
  if (uiHost.contains(parent) || parent.closest("[data-read-frog-vocabulary-ui]")) return false
  if (parent.isContentEditable || parent.closest("[contenteditable='true']")) return false
  if (INVALID_TAGS.has(parent.tagName)) return false
  return parent.getAttribute("aria-hidden") !== "true"
}

function safeColor(value: string, fallback: string) {
  return /^#[\da-f]{6}$/i.test(value) ? value : fallback
}

function updateHighlightStyles(style: HTMLStyleElement, state: VocabularyHunterState) {
  const unknownColor = safeColor(state.unknownHighlightColor, "#fb7185")
  const fuzzyColor = safeColor(state.fuzzyHighlightColor, "#fbbf24")
  style.textContent = `
    ::highlight(${UNKNOWN_HIGHLIGHT}) {
      background: color-mix(in srgb, ${unknownColor} 24%, transparent);
      text-decoration: underline dotted ${unknownColor} 2px;
      cursor: help;
    }
    ::highlight(${FUZZY_HIGHLIGHT}) {
      background: color-mix(in srgb, ${fuzzyColor} 28%, transparent);
      text-decoration: underline solid ${fuzzyColor} 2px;
      cursor: help;
    }
  `
}

function createHighlightStyles(state: VocabularyHunterState) {
  const style = document.createElement("style")
  style.dataset.readFrogVocabularyUi = ""
  updateHighlightStyles(style, state)
  document.documentElement.append(style)
  return style
}

function createHoverCard() {
  const host = document.createElement("read-frog-vocabulary-hunter")
  host.dataset.readFrogVocabularyUi = ""
  host.style.cssText =
    "all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none;font-family:Inter,system-ui,sans-serif"
  const shadow = host.attachShadow({ mode: "open" })
  shadow.innerHTML = `
    <style>
      *{box-sizing:border-box}
      #card{display:none;position:fixed;width:min(430px,calc(100vw - 24px));max-width:calc(100vw - 24px);
        max-height:min(580px,calc(100vh - 24px));
        overflow:auto;padding:17px;border:1px solid #dbe7df;border-radius:20px;
        background:linear-gradient(180deg,#fff 0%,#fbfdfb 100%);color:#17221c;
        box-shadow:0 22px 70px #17372130,0 3px 12px #17372118;pointer-events:auto}
      #card.open{display:block}
      .head{display:flex;align-items:start;justify-content:space-between;gap:10px}
      .wordline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.word{font-size:25px;font-weight:760;line-height:1.2}
      .level{padding:3px 7px;border-radius:999px;background:#edf6f0;color:#356046;font-size:10px;font-weight:650}
      .status{font-size:11px;color:#647067;margin-top:4px}
      .sentence{margin:10px 0;color:#46554c;font-size:12px;line-height:1.5}
      .row{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
      button,a{font:inherit;border:1px solid #d6e0da;border-radius:10px;background:#f7faf8;color:#23362a;
        padding:8px 10px;text-decoration:none;cursor:pointer;transition:.15s ease}
      button:hover,a:hover{transform:translateY(-1px);background:#edf8f0}
      .judgement{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:4px;background:#f2f6f3;border-radius:13px}
      .judgement button{min-width:0;border:0;background:transparent;white-space:nowrap}.judgement button.active[data-action=known]{background:#dcfce7;color:#166534}
      .judgement button.active[data-action=fuzzy]{background:#fef3c7;color:#92400e}
      .judgement button.active[data-action=unknown]{background:#ffe4e6;color:#9f1239}
      .tabs{padding-bottom:2px;border-bottom:1px solid #e6ece8}.tabs button{font-size:12px;padding:7px 9px;cursor:grab}
      .tabs button.dragging{opacity:.45}.tabs button.drag-over{outline:2px solid #79a98b;outline-offset:2px}
      .tabs button[data-dict=haici]{color:#087f5b}.tabs button[data-dict=ai]{color:#6d28d9}
      .tabs button.active{color:#fff;background:#28543a;border-color:#28543a}
      .tabs button.active[data-dict=haici]{background:#0f8b6d;border-color:#0f8b6d}
      .tabs button.active[data-dict=ai]{background:#6d4acb;border-color:#6d4acb}
      .result{display:none;max-height:280px;overflow:auto;margin-top:12px;padding:12px 13px;border:1px solid #e3ebe5;border-radius:13px;background:#fff}
      .result.open{display:block}.loading{color:#52695a;font-size:12px}.error{color:#b42318}
      .dict-title{font-size:11px;font-weight:700;color:#748079;margin-bottom:7px}.dict-text{white-space:pre-wrap;font-size:13px;line-height:1.65}
      .entry-word{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}.entry-word strong{font-size:22px;color:#23824b}
      .entry-level{padding:3px 7px;border-radius:999px;background:#e8f5ed;color:#397052;font-size:10px}
      .phonetics{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.phonetic{padding:6px 9px;border-radius:9px;background:#f1f6f9;color:#315b70}
      .phonetic b{margin-right:5px;color:#6b7c84;font-size:11px}.phonetic span{font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px}
      .meanings{display:grid;gap:7px}.meaning{display:grid;grid-template-columns:46px 1fr;gap:8px;align-items:start}
      .pos{padding:3px 6px;border-radius:7px;background:#e9f7ed;color:#247442;text-align:center;font-size:12px;font-weight:750}
      .definition{color:#26362d;font-size:13px;line-height:1.55}.forms{margin-top:10px;padding-top:9px;border-top:1px dashed #dce6df;color:#66746b;font-size:12px}
      details{margin-top:10px;border-top:1px solid #e5ece7;padding-top:9px}summary{cursor:pointer;color:#387353;font-size:12px;font-weight:650}
      .details-text{margin-top:8px;white-space:pre-wrap;color:#4c5b52;font-size:12px;line-height:1.65}
      .suggestions{display:grid;gap:7px;margin-top:10px}.suggestion{display:block;width:100%;text-align:left;padding:9px 10px}
      .suggestion strong{display:block;color:#1683a2;font-size:14px}.suggestion span{display:block;margin-top:2px;color:#536159;font-size:12px;line-height:1.45}
      dl{margin:0;display:grid;gap:8px}dt{font-size:11px;color:#758078}dd{margin:2px 0 0;white-space:pre-wrap;
        font-size:13px;line-height:1.5}.close{padding:3px 7px;border:0;background:transparent;font-size:18px}
    </style>
    <section id="card" role="dialog" aria-label="ReadFrog 生词卡">
      <div class="head">
        <div><div class="wordline"><div class="word" id="word"></div><span class="level" id="level"></span></div><div class="status" id="status"></div></div>
        <button class="close" data-action="close" title="关闭">×</button>
      </div>
      <div class="sentence" id="sentence"></div>
      <div class="row judgement">
        <button data-action="known" title="快捷键 Alt+1">✓ 已掌握</button>
        <button data-action="fuzzy" title="快捷键 Alt+2">◐ 待巩固</button>
        <button data-action="unknown" title="快捷键 Alt+3">○ 未掌握</button>
      </div>
      <div class="row tabs" id="tabs">
        <button draggable="true" data-dict="haici">海词</button>
        <button draggable="true" data-dict="collins">Collins</button>
        <button draggable="true" data-dict="longman">Longman</button>
        <button draggable="true" data-dict="google">Google</button>
        <button draggable="true" data-dict="ai">AI 解释</button>
      </div>
      <div class="result" id="result"></div>
      <div class="row"><a id="source-link" target="_blank" rel="noreferrer" hidden>打开单词所在的页面链接</a></div>
    </section>
  `
  document.documentElement.append(host)
  return { host, shadow }
}

function sentenceForRange(range: Range) {
  const text = range.startContainer.textContent ?? range.toString()
  const sentenceStart = Math.max(0, text.lastIndexOf(".", range.startOffset - 1) + 1)
  const nextPeriod = text.indexOf(".", range.endOffset)
  const end = nextPeriod === -1 ? Math.min(text.length, sentenceStart + 300) : nextPeriod + 1
  return text.slice(sentenceStart, end).replace(/\s+/g, " ").trim()
}

function findLinkForRange(range: Range) {
  const parent =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement
  return parent?.closest<HTMLAnchorElement>("a[href]") ?? null
}

function positionCard(card: HTMLElement, range: Range) {
  const rect = range.getBoundingClientRect()
  const viewportPadding = 12
  const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2)
  const cardWidth = Math.min(430, availableWidth)
  const cardHeight = Math.min(
    card.scrollHeight || 320,
    Math.max(0, window.innerHeight - viewportPadding * 2),
  )
  const preferredLeft =
    rect.left + cardWidth <= window.innerWidth - viewportPadding
      ? rect.left
      : rect.right - cardWidth
  const left = Math.max(
    viewportPadding,
    Math.min(preferredLeft, window.innerWidth - cardWidth - viewportPadding),
  )
  const below = rect.bottom + 8
  const top =
    below + cardHeight <= window.innerHeight - viewportPadding
      ? below
      : Math.max(
          viewportPadding,
          Math.min(rect.top - cardHeight - 8, window.innerHeight - cardHeight - viewportPadding),
        )
  card.style.width = `${cardWidth}px`
  card.style.maxHeight = `${Math.max(0, window.innerHeight - viewportPadding * 2)}px`
  card.style.left = `${left}px`
  card.style.top = `${top}px`
}

function statusText(word: string, state: VocabularyHunterState) {
  const status = state.statuses[word]
  if (status === "known") return "已确认掌握，不再标注"
  if (status === "fuzzy") return "记忆不稳定，建议结合语境巩固"
  return "尚未掌握"
}

async function requestDictionaryExplanation(
  word: string,
  sentence: string,
  render: (result: Record<string, unknown> | null, error?: string, complete?: boolean) => void,
) {
  const config = await getLocalConfig()
  const action =
    config?.selectionToolbar.customActions.find(
      (item) => item.enabled !== false && item.id === "default-dictionary",
    ) ??
    config?.selectionToolbar.customActions.find(
      (item) => item.enabled !== false && item.icon === "tabler:book-2",
    )

  if (!config || !action) {
    render(null, "请先在 ReadFrog 的“自定义 AI 操作”中启用词典操作。")
    return
  }

  const provider = resolveProviderRefForCapability(
    "selectionToolbar.customAction",
    config.providersConfig,
    action.providerId,
  )
  if (!provider) {
    render(null, "词典操作所选的 AI 服务当前不可用。")
    return
  }

  const webContext = await getOrCreateWebPageContext().catch(() => null)
  const promptTokens = {
    selection: word,
    paragraphs: sentence,
    targetLanguage: LANG_CODE_TO_EN_NAME[config.language.targetCode],
    webTitle: webContext?.webTitle ?? document.title,
    webContent: webContext?.webContent ?? "",
  }
  const instructions = buildSelectionToolbarCustomActionSystemPrompt(
    action.systemPrompt,
    promptTokens,
    action.outputSchema,
  )
  const prompt = replaceSelectionToolbarCustomActionPromptTokens(action.prompt, promptTokens)
  const modelName = provider.kind === "local" ? (resolveModelId(provider.config.model) ?? "") : ""
  const reasoning = provider.kind === "local" ? getTopLevelReasoning(provider.config) : undefined
  const providerOptions =
    provider.kind === "local"
      ? getProviderOptionsWithOverride(
          modelName,
          provider.config.provider,
          provider.config.providerOptions,
          reasoning,
        )
      : undefined
  const temperature = provider.kind === "local" ? provider.config.temperature : undefined

  const payload = {
    providerId: provider.id,
    instructions,
    prompt,
    outputSchema: action.outputSchema.map(({ name, type }) => ({ name, type })),
    providerOptions,
    reasoning,
    temperature,
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await streamBackgroundStructuredObject(payload, {
        onChunk: (snapshot) => render(snapshot.output),
      })
      render(response.output, undefined, true)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 解释失败，请检查模型配置。"
      const isTransientNetworkError = /failed to fetch|network|load failed|connection/i.test(
        message,
      )
      if (attempt === 0 && isTransientNetworkError) {
        await new Promise((resolve) => setTimeout(resolve, 450))
        continue
      }
      render(null, message)
      return
    }
  }
}

async function start(ctx: ContentScriptContext) {
  if (!("highlights" in CSS) || typeof Highlight === "undefined") return

  let state = await getVocabularyHunterState()
  const vocabularyDictionary = await loadVocabularyDictionary().catch(() => undefined)
  if (vocabularyDictionary) {
    const mergedState = await mergeKnownWordsFromSync(state, vocabularyDictionary).catch(
      () => state,
    )
    if (mergedState !== state) {
      state = mergedState
      await setVocabularyHunterState(state)
    }
  }
  let trackedRanges: TrackedRange[] = []
  let selected: TrackedRange | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let hoverTimer: ReturnType<typeof setTimeout> | undefined
  let gistSyncTimer: ReturnType<typeof setTimeout> | undefined
  let pendingHover: TrackedRange | null = null
  let requestSequence = 0
  const unknownHighlight = new Highlight()
  const fuzzyHighlight = new Highlight()
  CSS.highlights.set(UNKNOWN_HIGHLIGHT, unknownHighlight)
  CSS.highlights.set(FUZZY_HIGHLIGHT, fuzzyHighlight)

  const style = createHighlightStyles(state)
  const { host, shadow } = createHoverCard()
  const card = shadow.querySelector<HTMLElement>("#card")!
  const wordLabel = shadow.querySelector<HTMLElement>("#word")!
  const levelLabel = shadow.querySelector<HTMLElement>("#level")!
  const statusLabel = shadow.querySelector<HTMLElement>("#status")!
  const sentenceLabel = shadow.querySelector<HTMLElement>("#sentence")!
  const result = shadow.querySelector<HTMLElement>("#result")!
  const sourceLink = shadow.querySelector<HTMLAnchorElement>("#source-link")!
  const tabs = shadow.querySelector<HTMLElement>("#tabs")!

  const save = () => setVocabularyHunterState(state)

  const scheduleGistAutoSync = () => {
    clearTimeout(gistSyncTimer)
    if (!state.gistAutoSync || !state.gistId || !state.gistToken) return
    gistSyncTimer = setTimeout(async () => {
      const currentState = await getVocabularyHunterState()
      if (!currentState.gistAutoSync || !currentState.gistId || !currentState.gistToken) return
      const knownWords = Object.entries(currentState.statuses)
        .filter(([, status]) => status === "known")
        .map(([word]) => word)
      try {
        const synced = await sendMessage("syncVocabularyGist", {
          gistId: currentState.gistId,
          token: currentState.gistToken,
          words: knownWords,
        })
        const statuses = { ...currentState.statuses }
        synced.words.forEach((word) => {
          const lemma =
            vocabularyDictionary?.get(word.toLocaleLowerCase())?.lemma ?? word.toLocaleLowerCase()
          statuses[lemma] = "known"
        })
        state = {
          ...currentState,
          statuses,
          gistLastSyncAt: Date.now(),
          gistLastSyncCount: synced.count,
          gistSyncError: "",
        }
        await setVocabularyHunterState(state)
      } catch (error) {
        state = {
          ...currentState,
          gistSyncError: error instanceof Error ? error.message : "自动同步失败",
        }
        await setVocabularyHunterState(state)
      }
    }, 4000)
  }

  const renderResult = (
    value: Record<string, unknown> | null,
    error?: string,
    complete = false,
  ) => {
    result.classList.add("open")
    if (error) {
      result.innerHTML = ""
      const errorNode = document.createElement("div")
      errorNode.className = "error"
      errorNode.textContent = error
      result.append(errorNode)
      return
    }
    if (!value) return
    const list = document.createElement("dl")
    Object.entries(value).forEach(([key, fieldValue]) => {
      if (fieldValue === undefined || fieldValue === null || fieldValue === "") return
      const term = document.createElement("dt")
      term.textContent = key
      const description = document.createElement("dd")
      description.textContent =
        typeof fieldValue === "string" ||
        typeof fieldValue === "number" ||
        typeof fieldValue === "boolean"
          ? String(fieldValue)
          : JSON.stringify(fieldValue, null, 2)
      list.append(term, description)
    })
    if (!list.childElementCount) {
      if (complete) renderResult(null, "AI 没有返回可显示的解释，请检查模型配置。")
      return
    }
    result.innerHTML = ""
    result.append(list)
  }

  const setActiveStatus = (word: string) => {
    const status = state.statuses[word] ?? "unknown"
    shadow.querySelectorAll("[data-action]").forEach((button) => {
      button.classList.toggle("active", (button as HTMLElement).dataset.action === status)
    })
  }

  const setActiveDictionary = (dictionary: VocabularyDictionary) => {
    shadow.querySelectorAll("[data-dict]").forEach((button) => {
      button.classList.toggle("active", (button as HTMLElement).dataset.dict === dictionary)
    })
  }

  const applyDictionaryOrder = () => {
    state.dictionaryOrder.forEach((dictionary) => {
      const button = tabs.querySelector<HTMLElement>(`[data-dict="${dictionary}"]`)
      if (button) tabs.append(button)
    })
  }
  applyDictionaryOrder()

  const showEmbeddedDictionary = async (
    dictionary: Exclude<VocabularyDictionary, "ai">,
    hit: TrackedRange,
  ) => {
    const currentSequence = ++requestSequence
    setActiveDictionary(dictionary)
    result.classList.add("open")
    result.innerHTML = `<div class="loading">${dictionary === "haici" ? "海词" : dictionary} 正在查询…</div>`
    positionCard(card, hit.range)
    try {
      const definition = await lookupEmbeddedDictionary(dictionary, hit.word)
      if (currentSequence !== requestSequence || selected?.word !== hit.word) return
      result.innerHTML = ""
      const title = document.createElement("div")
      title.className = "dict-title"
      title.textContent = definition.title
      const text = document.createElement("div")
      text.className = "dict-text"
      text.textContent = definition.text
      result.append(title)
      if (definition.entry) {
        const entryWord = document.createElement("div")
        entryWord.className = "entry-word"
        const keyword = document.createElement("strong")
        keyword.textContent = definition.entry.word
        entryWord.append(keyword)
        if (definition.entry.level) {
          const level = document.createElement("span")
          level.className = "entry-level"
          level.textContent = definition.entry.level
          entryWord.append(level)
        }
        const phonetics = document.createElement("div")
        phonetics.className = "phonetics"
        definition.entry.phonetics.forEach((item) => {
          const phonetic = document.createElement("div")
          phonetic.className = "phonetic"
          const region = document.createElement("b")
          region.textContent = item.region
          const value = document.createElement("span")
          value.textContent = item.value
          phonetic.append(region, value)
          phonetics.append(phonetic)
        })
        const meanings = document.createElement("div")
        meanings.className = "meanings"
        definition.entry.meanings.forEach((item) => {
          const meaning = document.createElement("div")
          meaning.className = "meaning"
          const partOfSpeech = document.createElement("span")
          partOfSpeech.className = "pos"
          partOfSpeech.textContent = item.partOfSpeech
          const meaningText = document.createElement("span")
          meaningText.className = "definition"
          meaningText.textContent = item.definition
          meaning.append(partOfSpeech, meaningText)
          meanings.append(meaning)
        })
        result.append(entryWord, phonetics, meanings)
        if (definition.entry.forms) {
          const forms = document.createElement("div")
          forms.className = "forms"
          forms.textContent = definition.entry.forms
          result.append(forms)
        }
        if (definition.entry.details) {
          const details = document.createElement("details")
          const summary = document.createElement("summary")
          summary.textContent = "查看更多释义与用法"
          const detailsText = document.createElement("div")
          detailsText.className = "details-text"
          detailsText.textContent = definition.entry.details
          details.append(summary, detailsText)
          result.append(details)
        }
      } else {
        result.append(text)
      }
      if (definition.suggestions?.length) {
        const suggestions = document.createElement("div")
        suggestions.className = "suggestions"
        definition.suggestions.forEach((suggestion) => {
          const button = document.createElement("button")
          button.className = "suggestion"
          button.dataset.lookupWord = suggestion.word
          const label = document.createElement("strong")
          label.textContent = suggestion.word
          const description = document.createElement("span")
          description.textContent = suggestion.description
          button.append(label, description)
          suggestions.append(button)
        })
        result.append(suggestions)
      }
      positionCard(card, hit.range)
    } catch (error) {
      if (currentSequence !== requestSequence) return
      renderResult(null, error instanceof Error ? error.message : "词典查询失败")
    }
  }

  const showCard = (hit: TrackedRange) => {
    clearTimeout(hoverTimer)
    pendingHover = null
    clearTimeout(hideTimer)
    const changedWord = selected?.word !== hit.word
    selected = hit
    wordLabel.textContent = hit.word
    levelLabel.textContent = getVocabularyLevel(hit.level).label
    statusLabel.textContent = statusText(hit.word, state)
    setActiveStatus(hit.word)
    shadow.querySelectorAll<HTMLElement>("[data-dict]").forEach((button) => {
      button.hidden = !state.enabledDictionaries.includes(
        button.dataset.dict as VocabularyDictionary,
      )
    })
    sentenceLabel.textContent = sentenceForRange(hit.range)
    if (changedWord) {
      result.classList.remove("open")
      result.innerHTML = ""
    }

    const link = findLinkForRange(hit.range)
    sourceLink.hidden = !link
    if (link) sourceLink.href = link.href
    card.classList.add("open")
    positionCard(card, hit.range)
    if (changedWord) {
      const defaultDictionary =
        state.dictionaryOrder.find(
          (item): item is Exclude<VocabularyDictionary, "ai"> =>
            item !== "ai" && state.enabledDictionaries.includes(item),
        ) ?? "haici"
      void showEmbeddedDictionary(defaultDictionary, hit)
    }
  }

  const hideCardSoon = () => {
    clearTimeout(hoverTimer)
    pendingHover = null
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => card.classList.remove("open"), 260)
  }

  const clearHighlights = () => {
    unknownHighlight.clear()
    fuzzyHighlight.clear()
    trackedRanges.forEach(({ range }) => range.detach())
    trackedRanges = []
  }

  const refresh = () => {
    clearHighlights()
    if (!state.enabled || !document.body) return

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode() && trackedRanges.length < MAX_RANGES) {
      const node = walker.currentNode as Text
      if (!isTextNodeEligible(node, host)) continue
      for (const occurrence of findCandidateWords(
        node.data,
        state.minimumLength,
        state.statuses,
        vocabularyDictionary,
        new Set(state.enabledLevels),
      )) {
        if (trackedRanges.length >= MAX_RANGES) break
        const range = document.createRange()
        range.setStart(node, occurrence.start)
        range.setEnd(node, occurrence.end)
        trackedRanges.push({ range, word: occurrence.word, level: occurrence.level })
        if (state.statuses[occurrence.word] === "fuzzy") fuzzyHighlight.add(range)
        else unknownHighlight.add(range)
      }
    }
  }

  const scheduleRefresh = () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(refresh, 350)
  }

  const hitTest = (event: MouseEvent) =>
    trackedRanges.find(({ range }) => {
      const rect = range.getBoundingClientRect()
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      )
    })

  document.addEventListener(
    "mousemove",
    (event) => {
      if (!state.enabled || event.composedPath().includes(host)) return
      const hit = hitTest(event)
      if (!hit) {
        hideCardSoon()
        return
      }
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed) {
        hideCardSoon()
        return
      }
      if (card.classList.contains("open") && selected?.range === hit.range) return
      if (pendingHover?.range === hit.range) return
      clearTimeout(hoverTimer)
      pendingHover = hit
      hoverTimer = setTimeout(() => {
        if (pendingHover?.range === hit.range) showCard(hit)
      }, 650)
    },
    true,
  )

  document.addEventListener(
    "click",
    (event) => {
      if (!state.enabled || event.composedPath().includes(host)) return
      const hit = hitTest(event)
      if (!hit) return
      event.preventDefault()
      event.stopImmediatePropagation()
      showCard(hit)
    },
    true,
  )

  card.addEventListener("mouseenter", () => clearTimeout(hideTimer))
  card.addEventListener("mouseleave", hideCardSoon)
  const keepCardInViewport = () => {
    if (selected && card.classList.contains("open")) positionCard(card, selected.range)
  }
  window.addEventListener("resize", keepCardInViewport)
  window.addEventListener("scroll", keepCardInViewport, true)

  let draggedDictionary: VocabularyDictionary | null = null
  let suppressDictionaryClick = false
  tabs.addEventListener("dragstart", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-dict]")
    if (!button) return
    draggedDictionary = button.dataset.dict as VocabularyDictionary
    button.classList.add("dragging")
    event.dataTransfer?.setData("text/plain", draggedDictionary)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
  })
  tabs.addEventListener("dragover", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-dict]")
    if (!button || button.dataset.dict === draggedDictionary) return
    event.preventDefault()
    tabs.querySelectorAll(".drag-over").forEach((item) => item.classList.remove("drag-over"))
    button.classList.add("drag-over")
  })
  tabs.addEventListener("drop", (event) => {
    event.preventDefault()
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-dict]")
    const targetDictionary = target?.dataset.dict as VocabularyDictionary | undefined
    if (!draggedDictionary || !targetDictionary || draggedDictionary === targetDictionary) return
    const order = state.dictionaryOrder.filter((item) => item !== draggedDictionary)
    order.splice(order.indexOf(targetDictionary), 0, draggedDictionary)
    state = { ...state, dictionaryOrder: order }
    applyDictionaryOrder()
    void save()
    suppressDictionaryClick = true
    setTimeout(() => {
      suppressDictionaryClick = false
    }, 0)
  })
  tabs.addEventListener("dragend", () => {
    draggedDictionary = null
    tabs.querySelectorAll(".dragging,.drag-over").forEach((item) => {
      item.classList.remove("dragging", "drag-over")
    })
  })

  const markSelected = (status: VocabularyStatus) => {
    if (!selected) return
    const selectedWord = selected.word
    state = {
      ...state,
      statuses: {
        ...state.statuses,
        [selected.word]: status,
      },
    }
    void save()
    if (vocabularyDictionary) {
      void syncKnownWord(selectedWord, status === "known", vocabularyDictionary)
    }
    scheduleGistAutoSync()
    card.classList.remove("open")
    selected = null
    refresh()
  }

  const handleShortcut = (event: KeyboardEvent) => {
    if (
      !event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !selected ||
      !card.classList.contains("open")
    ) {
      return
    }
    const target = event.target
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return
    }
    const statusByKey: Record<string, VocabularyStatus | undefined> = {
      "1": "known",
      "2": "fuzzy",
      "3": "unknown",
    }
    const status = statusByKey[event.key]
    if (!status) return
    event.preventDefault()
    event.stopImmediatePropagation()
    markSelected(status)
  }
  document.addEventListener("keydown", handleShortcut, true)

  shadow.addEventListener("click", (event) => {
    const summary = (event.target as HTMLElement).closest("summary")
    if (summary) {
      event.preventDefault()
      event.stopPropagation()
      const details = summary.closest("details")
      if (details) details.open = !details.open
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const lookupWord = (event.target as HTMLElement).closest<HTMLElement>("[data-lookup-word]")
      ?.dataset.lookupWord
    if (lookupWord && selected) {
      selected = { ...selected, word: lookupWord }
      wordLabel.textContent = lookupWord
      const wordInfo = vocabularyDictionary?.get(lookupWord)
      levelLabel.textContent = getVocabularyLevel(wordInfo?.level).label
      statusLabel.textContent = statusText(lookupWord, state)
      setActiveStatus(lookupWord)
      void showEmbeddedDictionary("haici", selected)
      return
    }

    const dictionary = (event.target as HTMLElement).closest<HTMLElement>("[data-dict]")?.dataset
      .dict as VocabularyDictionary | undefined
    if (suppressDictionaryClick) return
    if (dictionary && selected) {
      if (dictionary === "ai") {
        const currentSequence = ++requestSequence
        setActiveDictionary("ai")
        result.classList.add("open")
        result.innerHTML =
          '<div class="loading">ReadFrog AI 正在结合当前语境解释；网络波动时会自动重试一次…</div>'
        const word = selected.word
        const sentence = sentenceForRange(selected.range)
        void requestDictionaryExplanation(word, sentence, (value, error, complete) => {
          if (currentSequence === requestSequence) renderResult(value, error, complete)
        })
      } else {
        void showEmbeddedDictionary(dictionary, selected)
      }
      return
    }

    const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset
      .action
    if (!action) return
    if (action === "close") {
      card.classList.remove("open")
      return
    }
    if (!selected) return

    markSelected(action as VocabularyStatus)
  })

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => !host.contains(mutation.target))) scheduleRefresh()
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  refresh()
  const unwatchState = watchVocabularyHunterState((nextState) => {
    state = nextState
    updateHighlightStyles(style, state)
    applyDictionaryOrder()
    refresh()
  })

  ctx.onInvalidated(() => {
    clearTimeout(refreshTimer)
    clearTimeout(hideTimer)
    clearTimeout(hoverTimer)
    clearTimeout(gistSyncTimer)
    observer.disconnect()
    window.removeEventListener("resize", keepCardInViewport)
    window.removeEventListener("scroll", keepCardInViewport, true)
    document.removeEventListener("keydown", handleShortcut, true)
    unwatchState()
    clearHighlights()
    CSS.highlights.delete(UNKNOWN_HIGHLIGHT)
    CSS.highlights.delete(FUZZY_HIGHLIGHT)
    style.remove()
    host.remove()
  })
}

export default defineContentScript({
  matches: ["*://*/*", "file:///*"],
  runAt: "document_idle",
  main: start,
})
