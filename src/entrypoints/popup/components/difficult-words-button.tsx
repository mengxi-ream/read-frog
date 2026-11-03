import type { DifficultWordsTabState } from "@/utils/difficult-words/types"
import { IconHighlight, IconHighlightOff } from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { browser } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Kbd, KbdGroup } from "@/components/ui/base-ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getDifficultWordsShortcut } from "@/utils/constants/difficult-words"
import { useDifficultWordsAccess } from "@/utils/difficult-words/tab-state"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { formatHotkeyParts } from "@/utils/os"
import { isShortcutEmpty } from "@/utils/shortcut"
import { cn } from "@/utils/styles/utils"
import { isPageTranslatedAtom } from "../atoms/auto-translate"
import { isIgnoreTabAtom } from "../atoms/ignore"
import { isCurrentSiteInBlacklistAtom, isCurrentSiteInWhitelistAtom } from "../atoms/site-control"

/** While the page is being marked, its count is read again this often. */
const STATE_POLL_MS = 1_000
const NOT_STARTED: DifficultWordsTabState = { enabled: false, count: 0 }

/** Marks the difficult words on the page, or clears them. Shown to the accounts it is open to. */
export function DifficultWordsButton() {
  const difficultWords = useAtomValue(configFieldsAtomMap.difficultWords)
  // Asked afresh: opening the popup is where a newly opened feature is looked for.
  const access = useDifficultWordsAccess(difficultWords.enabled, { fresh: true })
  if (!difficultWords.enabled || (access.data !== "allowed" && access.data !== "unknown")) {
    return null
  }
  return <DifficultWordsToggle shortcut={getDifficultWordsShortcut(difficultWords)} />
}

function useActiveTabId() {
  const [tabId, setTabId] = useState<number | null>(null)
  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setTabId(tab?.id ?? null)
    })
  }, [])
  return tabId
}

function DifficultWordsToggle({ shortcut }: { shortcut: string }) {
  const queryClient = useQueryClient()
  const tabId = useActiveTabId()
  const isPageTranslated = useAtomValue(isPageTranslatedAtom)
  const pageTranslation = useAtomValue(configFieldsAtomMap.pageTranslation)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const { mode } = useAtomValue(configFieldsAtomMap.siteControl)
  const isCurrentSiteInWhitelist = useAtomValue(isCurrentSiteInWhitelistAtom)
  const isCurrentSiteInBlacklist = useAtomValue(isCurrentSiteInBlacklistAtom)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const stateKey = ["difficultWordsState", tabId] as const
  const { data: state = NOT_STARTED } = useQuery({
    queryKey: stateKey,
    queryFn: () => sendMessage("getDifficultWordsState", undefined, { tabId: tabId!, frameId: 0 }),
    enabled: tabId !== null,
    refetchInterval: (query) => (query.state.data?.enabled ? STATE_POLL_MS : false),
    retry: false,
    meta: { suppressToast: true },
  })
  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      sendMessage("setDifficultWordsEnabled", { enabled }, { tabId: tabId!, frameId: 0 }),
    onSuccess: (next) => queryClient.setQueryData(stateKey, next),
    meta: { suppressToast: true },
  })

  const isSiteBlocked = mode === "whitelist" ? !isCurrentSiteInWhitelist : isCurrentSiteInBlacklist
  // Clearing stays possible whatever the page turned into since.
  const blockedReason = state.enabled
    ? null
    : isIgnoreTab || isSiteBlocked
      ? i18n.t("difficultWords.unavailableHere")
      : isPageTranslated && pageTranslation.mode === "translationOnly"
        ? i18n.t("difficultWords.translationOnlyUnavailable")
        : null
  const isBlocked = blockedReason !== null || tabId === null

  const label = state.enabled ? i18n.t("difficultWords.clear") : i18n.t("difficultWords.scan")
  const ariaLabel = state.enabled
    ? i18n.t("difficultWords.clearCount", [String(state.count)])
    : label
  const shortcutParts = isShortcutEmpty(shortcut) ? [] : formatHotkeyParts(shortcut)

  // The label goes when it would squeeze the translate button's: languages
  // with long words keep only the icon, its name in the tooltip. Measured
  // again whenever either label changes, before the change is painted.
  const fitKey = `${label}|${state.enabled ? state.count : ""}|${isPageTranslated}`
  const [compactKey, setCompactKey] = useState<string | null>(null)
  const compact = compactKey === fitKey
  useLayoutEffect(() => {
    if (compact) return
    const row = buttonRef.current?.parentElement
    if (!row) return
    const clipped = Array.from(row.querySelectorAll<HTMLElement>("[data-fit-label]")).some(
      (element) => element.scrollWidth > element.clientWidth,
    )
    if (clipped) setCompactKey(fitKey)
  }, [compact, fitKey])

  const handleClick = () => {
    if (isBlocked || toggle.isPending) return
    toggle.mutate(!state.enabled)
  }

  const StateIcon = state.enabled ? IconHighlightOff : IconHighlight

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            ref={buttonRef}
            type="button"
            variant="accent"
            size={compact ? "icon" : "default"}
            aria-label={ariaLabel}
            aria-disabled={isBlocked || undefined}
            className={cn("max-w-full", isBlocked && "cursor-not-allowed opacity-50")}
            onClick={handleClick}
          />
        }
      >
        {(compact || !state.enabled) && <StateIcon data-icon="inline-start" />}
        {!compact && (
          <span data-fit-label className="min-w-0 truncate">
            {label}
          </span>
        )}
        {!compact && state.enabled && (
          <span className="rounded-full bg-accent-foreground/25 px-1.5 font-mono text-[11px] leading-4 tabular-nums">
            {state.count}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent className="max-w-64 flex-col items-start text-wrap has-data-[slot=kbd]:pr-3">
        {blockedReason ?? (
          <>
            {compact && <span className="font-medium">{label}</span>}
            {state.enabled
              ? i18n.t("difficultWords.clearTooltip")
              : i18n.t("difficultWords.scanTooltip")}
            {shortcutParts.length > 0 && (
              <KbdGroup className="flex">
                {shortcutParts.map((part) => (
                  <Kbd key={part}>{part}</Kbd>
                ))}
              </KbdGroup>
            )}
          </>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
