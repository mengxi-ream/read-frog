import type { VocabularyWordInfo } from "@/utils/vocabulary-hunter/candidates"
import type { VocabularyDictionary } from "@/utils/vocabulary-hunter/storage"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Input } from "@/components/ui/base-ui/input"
import { Switch } from "@/components/ui/base-ui/switch"
import {
  getVocabularyLevel,
  loadVocabularyDictionary,
  VOCABULARY_LEVELS,
} from "@/utils/vocabulary-hunter/dictionary-data"
import {
  DEFAULT_VOCABULARY_HUNTER_STATE,
  getVocabularyHunterState,
  setVocabularyHunterState,
  type VocabularyHunterState,
} from "@/utils/vocabulary-hunter/storage"
import {
  fetchWordHunterGist,
  mergeKnownWordsFromSync,
  readWordHunterBackup,
  syncKnownWord,
  syncKnownWords,
  syncWordsToWordHunterGist,
} from "@/utils/vocabulary-hunter/sync"
import { ConfigCard } from "../../components/config-card"
import { PageLayout } from "../../components/page-layout"

type StatusFilter = "all" | "known" | "fuzzy" | "unknown"

const STATUS_LABELS = {
  known: "已掌握",
  fuzzy: "待巩固",
  unknown: "未掌握",
} as const

const DICTIONARY_LABELS: Record<VocabularyDictionary, string> = {
  haici: "海词词典",
  collins: "Collins",
  longman: "Longman",
  google: "Google 词典",
  ai: "ReadFrog AI",
}

export function VocabularyHunterPage() {
  const [state, setState] = useState<VocabularyHunterState>(DEFAULT_VOCABULARY_HUNTER_STATE)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [dictionary, setDictionary] = useState<Map<string, VocabularyWordInfo>>(new Map())
  const [syncMessage, setSyncMessage] = useState("")
  const [gistUrl, setGistUrl] = useState("")
  const [gistToken, setGistToken] = useState("")
  const [gistLoading, setGistLoading] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void Promise.all([getVocabularyHunterState(), loadVocabularyDictionary()]).then(
      async ([currentState, loadedDictionary]) => {
        setDictionary(loadedDictionary)
        const mergedState = await mergeKnownWordsFromSync(currentState, loadedDictionary).catch(
          () => currentState,
        )
        setState(mergedState)
        setGistUrl(mergedState.gistId)
        setGistToken(mergedState.gistToken)
        if (mergedState !== currentState) await setVocabularyHunterState(mergedState)
      },
    )
  }, [])

  const updateState = (next: VocabularyHunterState) => {
    setState(next)
    void setVocabularyHunterState(next)
  }

  const words = useMemo(
    () =>
      Object.entries(state.statuses)
        .filter(
          ([word, status]) =>
            (filter === "all" || status === filter) &&
            word.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
        )
        .sort(([left], [right]) => {
          const leftRank = getVocabularyLevel(dictionary.get(left)?.level).rank
          const rightRank = getVocabularyLevel(dictionary.get(right)?.level).rank
          return rightRank - leftRank || left.localeCompare(right)
        }),
    [dictionary, filter, query, state.statuses],
  )

  const counts = useMemo(
    () => ({
      known: Object.values(state.statuses).filter((status) => status === "known").length,
      fuzzy: Object.values(state.statuses).filter((status) => status === "fuzzy").length,
      unknown: Object.values(state.statuses).filter((status) => status === "unknown").length,
    }),
    [state.statuses],
  )

  const removeWord = (word: string) => {
    const statuses = { ...state.statuses }
    delete statuses[word]
    updateState({ ...state, statuses })
    void syncKnownWord(word, false, dictionary)
  }

  const importBackupText = async (text: string, source: string) => {
    try {
      const importedWords = readWordHunterBackup(text)
      const lemmas = new Set(
        importedWords.map(
          (word) => dictionary.get(word.toLocaleLowerCase())?.lemma ?? word.toLocaleLowerCase(),
        ),
      )
      const statuses = { ...state.statuses }
      lemmas.forEach((word) => {
        statuses[word] = "known"
      })
      const nextState = { ...state, statuses }
      updateState(nextState)
      await syncKnownWords(lemmas, dictionary)
      setSyncMessage(`已从${source}导入并同步 ${lemmas.size} 个已掌握单词`)
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "导入失败")
    }
  }

  const importWordHunterBackup = async (file: File) => {
    await importBackupText(await file.text(), "备份文件")
  }

  const importFromGist = async () => {
    setGistLoading(true)
    setSyncMessage("")
    try {
      const backup = await fetchWordHunterGist(gistUrl, gistToken)
      await importBackupText(backup, "GitHub Gist")
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Gist 导入失败")
    } finally {
      setGistLoading(false)
    }
  }

  const syncToGist = async () => {
    setGistLoading(true)
    setSyncMessage("")
    try {
      const localKnownWords = Object.entries(state.statuses)
        .filter(([, status]) => status === "known")
        .map(([word]) => word)
      const result = await syncWordsToWordHunterGist(gistUrl, gistToken, localKnownWords)
      const mergedWords = new Set(
        result.words.map(
          (word) => dictionary.get(word.toLocaleLowerCase())?.lemma ?? word.toLocaleLowerCase(),
        ),
      )
      const statuses = { ...state.statuses }
      mergedWords.forEach((word) => {
        statuses[word] = "known"
      })
      await syncKnownWords(mergedWords, dictionary)
      const nextState = {
        ...state,
        statuses,
        gistId: gistUrl.trim(),
        gistToken: gistToken.trim(),
        gistAutoSync: true,
        gistLastSyncAt: Date.now(),
        gistLastSyncCount: result.count,
        gistSyncError: "",
      }
      updateState(nextState)
      setSyncMessage(`同步成功：Gist 中共有 ${result.count} 个已掌握单词，自动同步已开启`)
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "同步到 Gist 失败")
    } finally {
      setGistLoading(false)
    }
  }

  return (
    <PageLayout title="生词猎手" innerClassName="flex flex-col px-8">
      <ConfigCard
        title="网页生词标注"
        description="生词卡会在鼠标悬浮时出现，不再显示独立的页面按钮。"
      >
        <div className="flex flex-col gap-5 rounded-xl border p-5">
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium">启用生词标注</span>
              <span className="text-sm text-muted-foreground">
                红色为未掌握，琥珀色为待巩固；已掌握的词不再标注。
              </span>
            </span>
            <Switch
              checked={state.enabled}
              onCheckedChange={(enabled) => updateState({ ...state, enabled })}
            />
          </label>
          <div>
            <div className="mb-3 font-medium">标注颜色</div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border p-3">
                <span>
                  <span className="block text-sm font-medium">未掌握</span>
                  <span className="text-xs text-muted-foreground">尚未掌握词汇的底色</span>
                </span>
                <input
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1"
                  value={state.unknownHighlightColor}
                  onChange={(event) =>
                    updateState({ ...state, unknownHighlightColor: event.target.value })
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border p-3">
                <span>
                  <span className="block text-sm font-medium">待巩固</span>
                  <span className="text-xs text-muted-foreground">记忆不稳定词汇的底色</span>
                </span>
                <input
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1"
                  value={state.fuzzyHighlightColor}
                  onChange={(event) =>
                    updateState({ ...state, fuzzyHighlightColor: event.target.value })
                  }
                />
              </label>
            </div>
          </div>
          <div>
            <div className="mb-3 font-medium">标注词汇等级</div>
            <div className="grid gap-2 md:grid-cols-2">
              {VOCABULARY_LEVELS.map((level) => (
                <label
                  key={level.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <span>
                    <span className="block text-sm font-medium">{level.label}</span>
                    <span className="text-xs text-muted-foreground">{level.description}</span>
                  </span>
                  <Switch
                    checked={state.enabledLevels.includes(level.id)}
                    onCheckedChange={(checked) =>
                      updateState({
                        ...state,
                        enabledLevels: checked
                          ? [...state.enabledLevels, level.id]
                          : state.enabledLevels.filter((item) => item !== level.id),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <div className="font-medium">悬浮卡快捷键</div>
            <p className="mt-1 text-sm text-muted-foreground">
              悬浮卡打开时：Alt+1 标记为已掌握，Alt+2 标记为待巩固，Alt+3
              标记为未掌握。输入框和编辑区域内不会触发。
            </p>
          </div>
        </div>
      </ConfigCard>

      <ConfigCard
        title="内嵌词典"
        description="释义直接显示在网页悬浮卡中，不会打开新的词典网页。海词默认排在第一位。"
      >
        <div className="grid gap-2 md:grid-cols-2">
          {(Object.keys(DICTIONARY_LABELS) as VocabularyDictionary[]).map((item) => (
            <label key={item} className="flex items-center justify-between rounded-xl border p-4">
              <span
                className={
                  item === "ai" ? "text-violet-700" : item === "haici" ? "text-emerald-700" : ""
                }
              >
                {DICTIONARY_LABELS[item]}
              </span>
              <Switch
                checked={state.enabledDictionaries.includes(item)}
                onCheckedChange={(checked) =>
                  updateState({
                    ...state,
                    enabledDictionaries: checked
                      ? [...state.enabledDictionaries, item]
                      : state.enabledDictionaries.filter((value) => value !== item),
                  })
                }
              />
            </label>
          ))}
        </div>
      </ConfigCard>

      <ConfigCard
        title="已掌握词汇同步"
        description="已掌握单词使用与 Word Hunter 类似的压缩位图写入 Chrome Sync，可在登录同一 Chrome 账号的设备间同步。"
      >
        <div className="flex flex-col gap-5 rounded-xl border p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <span className="block text-2xl font-semibold text-emerald-700">{counts.known}</span>
              <span className="text-sm text-emerald-800/70">本地已掌握</span>
            </div>
            <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/30">
              <span className="block text-2xl font-semibold text-blue-700">
                {state.gistLastSyncCount || "—"}
              </span>
              <span className="text-sm text-blue-800/70">上次同步后的 Gist 词数</span>
            </div>
            <div className="rounded-xl bg-violet-50 p-4 dark:bg-violet-950/30">
              <span className="block text-sm font-semibold text-violet-700">
                {state.gistLastSyncAt
                  ? new Date(state.gistLastSyncAt).toLocaleString()
                  : "尚未同步"}
              </span>
              <span className="mt-1 block text-sm text-violet-800/70">最近 Gist 同步</span>
            </div>
          </div>

          <div className="rounded-xl bg-muted/50 p-5">
            <div className="mb-4 font-medium">同步流程</div>
            <div className="grid items-center gap-2 text-center md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
              <div className="rounded-xl border bg-background p-3">
                <span className="mx-auto mb-2 grid size-8 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-700">
                  1
                </span>
                <span className="block text-sm font-medium">本地词汇</span>
                <span className="text-xs text-muted-foreground">收集已掌握状态</span>
              </div>
              <span className="hidden text-xl text-muted-foreground md:block">→</span>
              <div className="rounded-xl border bg-background p-3">
                <span className="mx-auto mb-2 grid size-8 place-items-center rounded-full bg-amber-100 font-semibold text-amber-700">
                  2
                </span>
                <span className="block text-sm font-medium">安全合并</span>
                <span className="text-xs text-muted-foreground">保留本地与远程单词</span>
              </div>
              <span className="hidden text-xl text-muted-foreground md:block">→</span>
              <div className="rounded-xl border bg-background p-3">
                <span className="mx-auto mb-2 grid size-8 place-items-center rounded-full bg-blue-100 font-semibold text-blue-700">
                  3
                </span>
                <span className="block text-sm font-medium">GitHub Gist</span>
                <span className="text-xs text-muted-foreground">更新 Word Hunter 备份</span>
              </div>
              <span className="hidden text-xl text-muted-foreground md:block">→</span>
              <div className="rounded-xl border bg-background p-3">
                <span className="mx-auto mb-2 grid size-8 place-items-center rounded-full bg-violet-100 font-semibold text-violet-700">
                  4
                </span>
                <span className="block text-sm font-medium">其他设备</span>
                <span className="text-xs text-muted-foreground">再次导入或同步</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => importInputRef.current?.click()}>
              导入 Word Hunter 备份
            </Button>
            <input
              ref={importInputRef}
              hidden
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importWordHunterBackup(file)
                event.target.value = ""
              }}
            />
            <span className="text-sm text-muted-foreground">
              支持 Word Hunter 导出的 word_hunter_backup_*.json
            </span>
          </div>
          <div className="grid gap-3 border-t pt-4">
            <div>
              <div className="font-medium">GitHub Gist 双向同步</div>
              <p className="mt-1 text-sm text-muted-foreground">
                “导入”只读取远程数据；“合并并同步”会先保留 Gist 中的单词，再加入本地已掌握词汇。
              </p>
            </div>
            <Input
              value={gistUrl}
              onChange={(event) => setGistUrl(event.target.value)}
              placeholder="Gist 地址或 ID"
            />
            <Input
              type="password"
              value={gistToken}
              onChange={(event) => setGistToken(event.target.value)}
              placeholder="私有 Gist 访问令牌（公开 Gist 留空）"
            />
            <label className="flex items-center justify-between rounded-xl border p-3">
              <span>
                <span className="block text-sm font-medium">自动同步到 Gist</span>
                <span className="text-xs text-muted-foreground">
                  已掌握词汇变化后延迟合并上传，避免频繁请求。
                </span>
              </span>
              <Switch
                checked={state.gistAutoSync}
                disabled={!state.gistToken || !state.gistId}
                onCheckedChange={(gistAutoSync) => updateState({ ...state, gistAutoSync })}
              />
            </label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                disabled={!gistUrl.trim() || gistLoading}
                onClick={() => void importFromGist()}
              >
                {gistLoading ? "正在导入…" : "导入 Gist"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!gistUrl.trim() || !gistToken.trim() || gistLoading}
                onClick={() => void syncToGist()}
              >
                {gistLoading ? "正在同步…" : "保存令牌并开启自动同步"}
              </Button>
              <span className="text-xs text-muted-foreground">
                令牌保存在本机扩展存储中，不会写入 Chrome Sync 或 Gist。
              </span>
            </div>
          </div>
          {state.gistSyncError ? (
            <p className="text-sm text-red-600">自动同步失败：{state.gistSyncError}</p>
          ) : null}
          {syncMessage ? <p className="text-sm text-emerald-700">{syncMessage}</p> : null}
        </div>
      </ConfigCard>

      <ConfigCard
        title="我的词汇"
        description="按难度从学术扩展、托福/GRE、雅思到基础词排序，集中查询你的学习判断。"
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              className="rounded-xl border p-3 text-left"
              onClick={() => setFilter("known")}
            >
              <span className="block text-2xl font-semibold">{counts.known}</span>
              <span className="text-sm text-muted-foreground">已掌握</span>
            </button>
            <button
              type="button"
              className="rounded-xl border p-3 text-left"
              onClick={() => setFilter("fuzzy")}
            >
              <span className="block text-2xl font-semibold">{counts.fuzzy}</span>
              <span className="text-sm text-muted-foreground">待巩固</span>
            </button>
            <button
              type="button"
              className="rounded-xl border p-3 text-left"
              onClick={() => setFilter("unknown")}
            >
              <span className="block text-2xl font-semibold">{counts.unknown}</span>
              <span className="text-sm text-muted-foreground">未掌握</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "known", "fuzzy", "unknown"] as const).map((item) => (
              <Button
                key={item}
                variant={filter === item ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(item)}
              >
                {item === "all" ? "全部" : STATUS_LABELS[item]}
              </Button>
            ))}
          </div>

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索单词"
          />

          <div className="max-h-[430px] overflow-auto rounded-xl border">
            {words.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">暂无匹配单词</p>
            ) : (
              <ul className="divide-y">
                {words.map(([word, status]) => (
                  <li key={word} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <span className="font-medium">{word}</span>
                      <span className="ml-3 text-xs text-muted-foreground">
                        {STATUS_LABELS[status]}
                      </span>
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {getVocabularyLevel(dictionary.get(word)?.level).label}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => removeWord(word)}>
                        清除判断
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ConfigCard>
    </PageLayout>
  )
}
