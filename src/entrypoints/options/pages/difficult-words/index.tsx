import { useAtom, useAtomValue } from "jotai"
import { Button } from "@/components/ui/base-ui/button"
import { Switch } from "@/components/ui/base-ui/switch"
import { openLogIn } from "@/components/user-account-menu/shared"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { getDifficultWordsShortcut } from "@/utils/constants/difficult-words"
import {
  getSelectionToolbarActions,
  resolveDifficultWordLookupAction,
} from "@/utils/custom-actions"
import { useDifficultWordsAccess } from "@/utils/difficult-words/tab-state"
import { i18n } from "@/utils/i18n"
import { ActionSelect } from "../../components/action-select"
import { ConfigItem } from "../../components/config-item"
import { ConfigSection } from "../../components/config-section"
import { PageLayout } from "../../components/page-layout"
import { ShortcutConfigItem } from "../shortcuts/shortcut-config-item"
import { ColorsItem } from "./colors-item"
import { LevelsSection } from "./levels-section"

export function DifficultWordsPage() {
  return (
    <PageLayout
      title={i18n.t("options.difficultWords.title")}
      description={i18n.t("options.difficultWords.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <AccessNotice />
      <EnableItem />
      <ConfigSection title={i18n.t("options.difficultWords.usage.title")}>
        <ShortcutItem />
        <LookupActionItem />
        <ColorsItem />
      </ConfigSection>
      <LevelsSection />
    </PageLayout>
  )
}

/** The page is reachable by link while the feature is in testing: say so to whom it is not open. */
function AccessNotice() {
  const access = useDifficultWordsAccess(true, { fresh: true })
  if (access.data !== "signedOut" && access.data !== "denied") return null

  return (
    <div className="flex flex-col items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-4">
      <p className="text-sm text-muted-foreground">
        {access.data === "signedOut"
          ? i18n.t("difficultWords.signInRequired")
          : i18n.t("difficultWords.restricted")}
      </p>
      {access.data === "signedOut" && (
        <Button variant="outline" size="sm" onClick={openLogIn}>
          {i18n.t("account.login")}
        </Button>
      )}
    </div>
  )
}

function EnableItem() {
  const [difficultWords, setDifficultWords] = useAtom(configFieldsAtomMap.difficultWords)

  return (
    <ConfigItem
      id="difficult-words-enable"
      title={i18n.t("options.difficultWords.enable.title")}
      description={i18n.t("options.difficultWords.enable.description")}
    >
      <Switch
        checked={difficultWords.enabled}
        onCheckedChange={(enabled) => {
          void setDifficultWords({ enabled })
        }}
      />
    </ConfigItem>
  )
}

function ShortcutItem() {
  const [difficultWords, setDifficultWords] = useAtom(configFieldsAtomMap.difficultWords)

  return (
    <ShortcutConfigItem
      id="difficult-words-shortcut"
      title={i18n.t("options.difficultWords.shortcut.title")}
      description={i18n.t("options.difficultWords.shortcut.description")}
      shortcut={getDifficultWordsShortcut(difficultWords)}
      onChange={(shortcut) => {
        void setDifficultWords({ shortcut })
      }}
    />
  )
}

function LookupActionItem() {
  const config = useAtomValue(configAtom)
  const [, setDifficultWords] = useAtom(configFieldsAtomMap.difficultWords)
  const selectedAction = resolveDifficultWordLookupAction(config)
  // Every enabled action, plus the one in effect even when it is off.
  const choices = getSelectionToolbarActions(config.selectionToolbar).filter(
    (action) => action.enabled !== false || action.id === selectedAction.id,
  )
  const title = i18n.t("options.difficultWords.lookupAction.title")

  return (
    <ConfigItem
      id="difficult-words-lookup-action"
      title={title}
      description={i18n.t("options.difficultWords.lookupAction.description")}
    >
      <ActionSelect
        actions={choices}
        selected={selectedAction}
        label={title}
        onSelect={(lookupActionId) => void setDifficultWords({ lookupActionId })}
      />
    </ConfigItem>
  )
}
