import { useSetAtom, useStore } from "jotai"
import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { isBuiltInActionId } from "@/utils/constants/custom-action"
import { i18n } from "@/utils/i18n"
import { consumeCustomActionDeepLink } from "@/utils/navigation"
import { ConfigItem } from "../../components/config-item"
import { EntityEditorLayout } from "../../components/entity-editor-layout"
import { CustomActionConfigForm } from "./action-config-form"
import { customActionEditorTabAtom, selectedCustomActionIdAtom } from "./atoms"
import { CustomActionCardList } from "./components/action-card-list"
import { IntroVideoButton } from "./components/intro-video-button"

/**
 * Applies `?actionId=…&tab=…` once, then strips it. Lives in the parent on purpose: a parent's
 * effect runs after its children's, and jotai 3 subscribes in an effect without re-reading the
 * atom, so a selection written from the list's own mount effect never reached the editor beside it.
 * Keyed on `search` alone, reading actions from the store: an autosave must not re-apply a link.
 */
function useCustomActionDeepLink() {
  const store = useStore()
  const setSelectedCustomActionId = useSetAtom(selectedCustomActionIdAtom)
  const setEditorTab = useSetAtom(customActionEditorTabAtom)
  const { search } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const deepLink = consumeCustomActionDeepLink(search)
    if (!deepLink) return

    const { actionId, tab } = deepLink
    if (actionId) {
      const actions = store.get(configFieldsAtomMap.selectionToolbar).customActions
      if (isBuiltInActionId(actionId) || actions.some((action) => action.id === actionId)) {
        // A link to an action without a tab lands on its first tab.
        void setSelectedCustomActionId(actionId).then((proceeded) => {
          if (proceeded) setEditorTab(tab ?? "config")
        })
      }
    } else if (tab) {
      setEditorTab(tab)
    }

    void navigate({ search: deepLink.remainingSearch }, { replace: true })
  }, [search, navigate, store, setSelectedCustomActionId, setEditorTab])
}

export function CustomActionsConfig() {
  useCustomActionDeepLink()

  return (
    <ConfigItem
      id="custom-actions"
      orientation="vertical"
      title={i18n.t("options.selectionToolbar.customActions.configTitle")}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {i18n.t("options.selectionToolbar.customActions.description")}
          <IntroVideoButton />
        </span>
      }
    >
      <EntityEditorLayout list={<CustomActionCardList />} editor={<CustomActionConfigForm />} />
    </ConfigItem>
  )
}
