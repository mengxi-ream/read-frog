import type { ComponentType, ReactNode } from "react"
import type { RoutePath } from "./app-sidebar/nav-items"
import type { FeatureTag } from "@/utils/features"
import { useAtomValue } from "jotai"
import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router"
import { configAtom } from "@/utils/atoms/config"
import { switchedOffFeature } from "@/utils/features"
import { getRouteFeature, ROUTE_DEFS } from "./app-sidebar/nav-items"
import { buildSimpleModeRowLink } from "./pages/advanced/simple-mode/links"

const UsagePage = lazy(() =>
  import("./pages/usage").then((module) => ({ default: module.UsagePage })),
)
const PreferencePage = lazy(() =>
  import("./pages/preference").then((module) => ({ default: module.PreferencePage })),
)
const ShortcutsPage = lazy(() =>
  import("./pages/shortcuts").then((module) => ({ default: module.ShortcutsPage })),
)
const ApiProvidersPage = lazy(() =>
  import("./pages/api-providers").then((module) => ({ default: module.ApiProvidersPage })),
)
const CustomActionsPage = lazy(() =>
  import("./pages/custom-actions").then((module) => ({ default: module.CustomActionsPage })),
)
const TranslationPage = lazy(() =>
  import("./pages/translation").then((module) => ({ default: module.TranslationPage })),
)
const VideoSubtitlesPage = lazy(() =>
  import("./pages/video-subtitles").then((module) => ({ default: module.VideoSubtitlesPage })),
)
const FloatingButtonPage = lazy(() =>
  import("./pages/floating-button").then((module) => ({ default: module.FloatingButtonPage })),
)
const SelectionToolbarPage = lazy(() =>
  import("./pages/selection-toolbar").then((module) => ({ default: module.SelectionToolbarPage })),
)
const ContextMenuPage = lazy(() =>
  import("./pages/context-menu").then((module) => ({ default: module.ContextMenuPage })),
)
const InputTranslationPage = lazy(() =>
  import("./pages/input-translation").then((module) => ({ default: module.InputTranslationPage })),
)
const TextToSpeechPage = lazy(() =>
  import("./pages/text-to-speech").then((module) => ({ default: module.TextToSpeechPage })),
)
const DifficultWordsPage = lazy(() =>
  import("./pages/difficult-words").then((module) => ({ default: module.DifficultWordsPage })),
)
const GlossaryPage = lazy(() =>
  import("./pages/advanced/glossary").then((module) => ({ default: module.GlossaryPage })),
)
const GlossaryEditorPage = lazy(() =>
  import("./pages/advanced/glossary/editor-page").then((module) => ({
    default: module.GlossaryEditorPage,
  })),
)
const SimpleModePage = lazy(() =>
  import("./pages/advanced/simple-mode").then((module) => ({ default: module.SimpleModePage })),
)

/**
 * Advanced has no page of its own: old links to it land on its first entry, the glossary, or with
 * the glossary switched off, on its switch in simple mode.
 */
function AdvancedRedirect() {
  return <Navigate to="/advanced/glossary" replace />
}
const HelpAndCommunityPage = lazy(() =>
  import("./pages/help-and-community").then((module) => ({ default: module.HelpAndCommunityPage })),
)
const CustomCssPage = lazy(() =>
  import("./pages/translation/translation-style/custom-css").then((module) => ({
    default: module.CustomCssPage,
  })),
)
const PersonalizedPromptsPage = lazy(() =>
  import("./pages/translation/personalized-prompts/prompts").then((module) => ({
    default: module.PersonalizedPromptsPage,
  })),
)
const AutoTranslateWebsitesPage = lazy(() =>
  import("./pages/translation/translation-control/website-patterns-page").then((module) => ({
    default: module.AutoTranslateWebsitesPage,
  })),
)
const NeverAutoTranslateWebsitesPage = lazy(() =>
  import("./pages/translation/translation-control/website-patterns-page").then((module) => ({
    default: module.NeverAutoTranslateWebsitesPage,
  })),
)
const TranslationControlPage = lazy(() =>
  import("./pages/translation/translation-control/control-page").then((module) => ({
    default: module.TranslationControlPage,
  })),
)
const SiteRulesPage = lazy(() =>
  import("./pages/translation/translation-control/site-rules").then((module) => ({
    default: module.SiteRulesPage,
  })),
)
const TranslationQueuePage = lazy(() =>
  import("./pages/translation/translation-queue/queue-page").then((module) => ({
    default: module.TranslationQueuePage,
  })),
)
const ConfigBackupPage = lazy(() =>
  import("./pages/preference/config/config-backup").then((module) => ({
    default: module.ConfigBackupPage,
  })),
)
const ExtensionActivationPage = lazy(() =>
  import("./pages/preference/extension-activation/activation-page").then((module) => ({
    default: module.ExtensionActivationPage,
  })),
)
const SubtitlesCustomCssPage = lazy(() =>
  import("./pages/video-subtitles/subtitles-style/custom-css").then((module) => ({
    default: module.SubtitlesCustomCssPage,
  })),
)
const SubtitlesSitesPage = lazy(() =>
  import("./pages/video-subtitles/preference/sites-page").then((module) => ({
    default: module.SubtitlesSitesPage,
  })),
)
const SubtitlesStylePage = lazy(() =>
  import("./pages/video-subtitles/subtitles-style/style-editor").then((module) => ({
    default: module.SubtitlesStylePage,
  })),
)
const SubtitlesCustomPromptsPage = lazy(() =>
  import("./pages/video-subtitles/custom-prompts/prompts").then((module) => ({
    default: module.SubtitlesCustomPromptsPage,
  })),
)
const SubtitlesQueuePage = lazy(() =>
  import("./pages/video-subtitles/subtitles-queue/queue-page").then((module) => ({
    default: module.SubtitlesQueuePage,
  })),
)

const ROUTE_COMPONENTS: Record<RoutePath, ComponentType> = {
  "/": PreferencePage,
  "/usage": UsagePage,
  "/preference": PreferencePage,
  "/shortcuts": ShortcutsPage,
  "/api-providers": ApiProvidersPage,
  "/custom-actions": CustomActionsPage,
  "/page-translation": TranslationPage,
  "/video-subtitles": VideoSubtitlesPage,
  "/floating-button": FloatingButtonPage,
  "/selection-toolbar": SelectionToolbarPage,
  "/context-menu": ContextMenuPage,
  "/input-translation": InputTranslationPage,
  "/tts": TextToSpeechPage,
  "/difficult-words": DifficultWordsPage,
  "/advanced": AdvancedRedirect,
  "/help-and-community": HelpAndCommunityPage,
  "/advanced/glossary": GlossaryPage,
  "/advanced/glossary/:glossaryId": GlossaryEditorPage,
  "/advanced/simple-mode": SimpleModePage,
  "/preference/config-backup": ConfigBackupPage,
  "/preference/extension-activation": ExtensionActivationPage,
  "/page-translation/custom-css": CustomCssPage,
  "/page-translation/prompts": PersonalizedPromptsPage,
  "/page-translation/translation-control": TranslationControlPage,
  "/page-translation/translation-control/auto-translate-websites": AutoTranslateWebsitesPage,
  "/page-translation/translation-control/never-auto-translate-websites":
    NeverAutoTranslateWebsitesPage,
  "/page-translation/translation-control/site-rules": SiteRulesPage,
  "/page-translation/translation-queue": TranslationQueuePage,
  "/video-subtitles/sites": SubtitlesSitesPage,
  "/video-subtitles/style": SubtitlesStylePage,
  "/video-subtitles/style/custom-css": SubtitlesCustomCssPage,
  "/video-subtitles/prompts": SubtitlesCustomPromptsPage,
  "/video-subtitles/subtitles-queue": SubtitlesQueuePage,
}

function RouteLoadingFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      Loading settings...
    </div>
  )
}

/**
 * A page of a feature simple mode turned off is not there, the same as its sidebar entry: a link
 * or the address bar that still leads to it lands on the switch that brings it back.
 */
function FeatureRoute({ feature, children }: { feature: FeatureTag; children: ReactNode }) {
  const config = useAtomValue(configAtom)
  const off = switchedOffFeature(config, feature)
  if (off !== undefined) {
    return <Navigate to={buildSimpleModeRowLink(off)} replace />
  }
  return children
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {ROUTE_DEFS.map(({ path }) => {
          const Component = ROUTE_COMPONENTS[path]
          const feature = getRouteFeature(path)
          return (
            <Route
              key={path}
              path={path}
              element={
                feature === undefined ? (
                  <Component />
                ) : (
                  <FeatureRoute feature={feature}>
                    <Component />
                  </FeatureRoute>
                )
              }
            />
          )
        })}
      </Routes>
    </Suspense>
  )
}
