import type { VocabularyWordInfo } from "./candidates"
import type { VocabularyHunterState } from "./storage"
import { browser } from "#imports"

const BUCKET_SIZE = 400
const BUCKET_PREFIX = "rf_vocabulary_known_"

function bucketKey(index: number) {
  return `${BUCKET_PREFIX}${Math.floor(index / BUCKET_SIZE)}`
}

function setBitmapValue(bitmap: string | undefined, index: number, known: boolean) {
  const normalized = (bitmap ?? "").padEnd(BUCKET_SIZE, "0").slice(0, BUCKET_SIZE)
  const offset = index % BUCKET_SIZE
  return `${normalized.slice(0, offset)}${known ? "1" : "0"}${normalized.slice(offset + 1)}`
}

export async function syncKnownWord(
  word: string,
  known: boolean,
  dictionary: Map<string, VocabularyWordInfo>,
) {
  const wordInfo = dictionary.get(word)
  if (!wordInfo) return
  const key = bucketKey(wordInfo.index)
  const current = await browser.storage.sync.get(key)
  await browser.storage.sync.set({
    [key]: setBitmapValue(current[key] as string | undefined, wordInfo.index, known),
  })
}

export async function syncKnownWords(
  words: Iterable<string>,
  dictionary: Map<string, VocabularyWordInfo>,
) {
  const indices = [...words].flatMap((word) => {
    const wordInfo = dictionary.get(word.toLocaleLowerCase())
    return wordInfo ? [wordInfo.index] : []
  })
  const keys = [...new Set(indices.map(bucketKey))]
  const current = await browser.storage.sync.get(keys)
  const updates: Record<string, string> = {}
  indices.forEach((index) => {
    const key = bucketKey(index)
    updates[key] = setBitmapValue(updates[key] ?? (current[key] as string | undefined), index, true)
  })
  if (Object.keys(updates).length) await browser.storage.sync.set(updates)
}

export async function mergeKnownWordsFromSync(
  state: VocabularyHunterState,
  dictionary: Map<string, VocabularyWordInfo>,
) {
  const indexedWords: Array<string | undefined> = []
  dictionary.forEach((info) => {
    indexedWords[info.index] ??= info.lemma
  })
  const keys = Array.from(
    { length: Math.ceil(indexedWords.length / BUCKET_SIZE) },
    (_, index) => `${BUCKET_PREFIX}${index}`,
  )
  const stored = await browser.storage.sync.get(keys)
  const statuses = { ...state.statuses }
  let changed = false
  keys.forEach((key, bucketIndex) => {
    const bitmap = stored[key]
    if (typeof bitmap !== "string") return
    for (let offset = 0; offset < bitmap.length; offset += 1) {
      if (bitmap[offset] !== "1") continue
      const word = indexedWords[bucketIndex * BUCKET_SIZE + offset]
      if (word && statuses[word] !== "known") {
        statuses[word] = "known"
        changed = true
      }
    }
  })
  return changed ? { ...state, statuses } : state
}

function parseBackupObject(text: string): Record<string, unknown> {
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("不是有效的 Word Hunter 备份文件")
  }
  return parsed as Record<string, unknown>
}

export function readWordHunterBackup(text: string) {
  const parsed = parseBackupObject(text)
  if (parsed.known && typeof parsed.known === "object" && !Array.isArray(parsed.known)) {
    return Object.keys(parsed.known)
  }
  if (parsed.files && typeof parsed.files === "object" && !Array.isArray(parsed.files)) {
    for (const file of Object.values(parsed.files as Record<string, unknown>)) {
      if (!file || typeof file !== "object" || Array.isArray(file)) continue
      const content = (file as { content?: unknown }).content
      if (typeof content !== "string") continue
      try {
        return readWordHunterBackup(content)
      } catch {
        // Try the next file in an exported Gist response.
      }
    }
  }
  const entries = Object.entries(parsed)
  if (
    entries.length &&
    entries.every(
      ([word, value]) =>
        /^[a-z]+(?:'[a-z]+)?$/i.test(word) &&
        (typeof value === "string" || value === true || value === 1),
    )
  ) {
    return entries.map(([word]) => word)
  }
  throw new Error("文件中没有找到 Word Hunter 的 known 词汇数据")
}

function parseGistId(gistUrlOrId: string) {
  const gistId = gistUrlOrId.trim().replace(/\/$/, "").split("/").at(-1)?.split("?")[0]
  if (!gistId || !/^[\da-f]+$/i.test(gistId)) throw new Error("Gist 地址或 ID 不正确")
  return gistId
}

export async function fetchWordHunterGist(gistUrlOrId: string, token?: string) {
  const gistId = parseGistId(gistUrlOrId)
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: token?.trim()
      ? {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token.trim()}`,
        }
      : { Accept: "application/vnd.github+json" },
  })
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "找不到该 Gist；如果是私有 Gist，请填写访问令牌"
        : `读取 Gist 失败（${response.status}）`,
    )
  }
  const gist = (await response.json()) as {
    files?: Record<string, { content?: string; raw_url?: string; truncated?: boolean }>
  }
  const files = Object.values(gist.files ?? {})
  const preferred =
    gist.files?.["word_hunter_backup.json"] ??
    files.find((file) => file.content?.includes('"known"'))
  if (!preferred) throw new Error("该 Gist 中没有 Word Hunter 备份数据")
  if (preferred.content && !preferred.truncated) return preferred.content
  if (!preferred.raw_url) throw new Error("Gist 备份内容无法读取")
  const rawResponse = await fetch(preferred.raw_url)
  if (!rawResponse.ok) throw new Error("Gist 原始备份文件读取失败")
  return rawResponse.text()
}

export async function syncWordsToWordHunterGist(
  gistUrlOrId: string,
  token: string,
  localKnownWords: Iterable<string>,
) {
  if (!token.trim()) throw new Error("写入 Gist 必须填写具有 Gist 权限的访问令牌")
  const gistId = parseGistId(gistUrlOrId)
  const remoteText = await fetchWordHunterGist(gistId, token)
  const remoteBackup = parseBackupObject(remoteText)
  const remoteKnown =
    remoteBackup.known &&
    typeof remoteBackup.known === "object" &&
    !Array.isArray(remoteBackup.known)
      ? (remoteBackup.known as Record<string, unknown>)
      : {}
  const mergedKnown = { ...remoteKnown }
  for (const word of localKnownWords) mergedKnown[word] = "o"
  const now = Date.now()
  const content = JSON.stringify({
    ...remoteBackup,
    known: mergedKnown,
    context: remoteBackup.context ?? {},
    settings: remoteBackup.settings ?? {},
    knwon_update_timestamp: now,
  })
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        "word_hunter_backup.json": { content },
      },
    }),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(error?.message || `写入 Gist 失败（${response.status}）`)
  }
  return {
    count: Object.keys(mergedKnown).length,
    words: Object.keys(mergedKnown),
  }
}
