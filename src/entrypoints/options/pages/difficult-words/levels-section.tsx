import type { VocabLevel, VocabProfile } from "@read-frog/api-contract"
import type { ReactNode } from "react"
import { ORPCError } from "@orpc/client"
import { VOCAB_LEVELS } from "@read-frog/api-contract"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/base-ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Skeleton } from "@/components/ui/base-ui/skeleton"
import { openLogIn } from "@/components/user-account-menu/shared"
import { authClient } from "@/utils/auth/auth-client"
import { getLevelDescription, getLevelLabel } from "@/utils/difficult-words/levels"
import { i18n } from "@/utils/i18n"
import { getLanguageName } from "@/utils/language-labels"
import { orpc } from "@/utils/orpc/client"
import { ConfigItem } from "../../components/config-item"
import { ConfigSection } from "../../components/config-section"
import { SELECT_CONTENT_PROPS } from "../../components/select-content-props"

function errorCode(error: unknown): string | null {
  return error instanceof ORPCError ? error.code : null
}

/**
 * The reader's level in each language they have scanned, read from the
 * server, which keeps it with what they did with the words. Picking another
 * moves where the marking starts; the words already counted still count.
 */
export function LevelsSection() {
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const isSignedIn = !!session?.user
  const queryClient = useQueryClient()

  const profilesQuery = useQuery(
    orpc.vocab.profiles.queryOptions({
      enabled: isSignedIn,
      retry: false,
      staleTime: 60_000,
      meta: { suppressToast: true },
    }),
  )
  const setLevel = useMutation(
    orpc.vocab.setLevel.mutationOptions({
      onSuccess: (profile) => {
        queryClient.setQueryData(orpc.vocab.profiles.queryKey(), (previous) =>
          previous
            ? {
                profiles: previous.profiles.map((entry) =>
                  entry.lang === profile.lang ? profile : entry,
                ),
              }
            : previous,
        )
      },
      meta: { errorDescription: i18n.t("difficultWords.level.saveFailed") },
    }),
  )

  function renderContent() {
    if (isSessionPending || (isSignedIn && profilesQuery.isPending)) {
      return <Skeleton className="h-4 w-64" />
    }
    if (!isSignedIn || errorCode(profilesQuery.error) === "UNAUTHORIZED") {
      return (
        <div className="flex flex-col items-start gap-2.5">
          <Notice>{i18n.t("options.difficultWords.levels.loginRequired")}</Notice>
          <Button variant="outline" size="sm" onClick={openLogIn}>
            {i18n.t("account.login")}
          </Button>
        </div>
      )
    }
    if (errorCode(profilesQuery.error) === "VOCAB_BETA_RESTRICTED") {
      return <Notice>{i18n.t("difficultWords.restricted")}</Notice>
    }
    if (profilesQuery.isError || !profilesQuery.data) {
      return <Notice>{i18n.t("options.difficultWords.levels.loadError")}</Notice>
    }
    if (profilesQuery.data.profiles.length === 0) {
      return <Notice>{i18n.t("options.difficultWords.levels.empty")}</Notice>
    }
    return null
  }

  const content = renderContent()

  return (
    <ConfigSection
      id="difficult-words-levels"
      title={i18n.t("options.difficultWords.levels.title")}
    >
      <ConfigItem
        orientation="vertical"
        description={i18n.t("options.difficultWords.levels.description")}
      >
        {content}
      </ConfigItem>
      {content === null &&
        profilesQuery.data?.profiles.map((profile) => (
          <LevelItem
            key={profile.lang}
            profile={profile}
            disabled={setLevel.isPending}
            onChange={(level) => setLevel.mutate({ lang: profile.lang, level })}
          />
        ))}
    </ConfigSection>
  )
}

function LevelItem({
  profile,
  disabled,
  onChange,
}: {
  profile: VocabProfile
  disabled: boolean
  onChange: (level: VocabLevel) => void
}) {
  const languageName = getLanguageName(profile.lang)

  return (
    <ConfigItem
      id={`difficult-words-level-${profile.lang}`}
      title={languageName}
      description={i18n.t("options.difficultWords.levels.known", [
        profile.thresholdRank.toLocaleString(),
      ])}
    >
      <Select
        value={profile.level}
        disabled={disabled}
        onValueChange={(level) => {
          if (level && level !== profile.level) onChange(level)
        }}
      >
        <SelectTrigger size="sm" aria-label={i18n.t("difficultWords.level.title", [languageName])}>
          <SelectValue>{getLevelLabel(profile.level)}</SelectValue>
        </SelectTrigger>
        <SelectContent {...SELECT_CONTENT_PROPS} className="max-w-80">
          <SelectGroup>
            {VOCAB_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{getLevelLabel(level)}</span>
                  <span className="text-xs leading-relaxed text-pretty text-muted-foreground">
                    {getLevelDescription(level)}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </ConfigItem>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-[18px] text-muted-foreground">{children}</p>
}
