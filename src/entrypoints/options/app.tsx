import type { ComponentType } from "react"
import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router"
import { ROUTE_DEFS } from "./app-sidebar/nav-items"

type RoutePath = (typeof ROUTE_DEFS)[number]["path"]

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
const SiteRulesPage = lazy(() =>
  import("./pages/site-rules").then((module) => ({ default: module.SiteRulesPage })),
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
  import("./pages/translation/translate-control/website-patterns-page").then((module) => ({
    default: module.AutoTranslateWebsitesPage,
  })),
)
const NeverAutoTranslateWebsitesPage = lazy(() =>
  import("./pages/translation/translate-control/website-patterns-page").then((module) => ({
    default: module.NeverAutoTranslateWebsitesPage,
  })),
)
const ConfigBackupPage = lazy(() =>
  import("./pages/preference/config/config-backup").then((module) => ({
    default: module.ConfigBackupPage,
  })),
)

const ROUTE_COMPONENTS: Record<RoutePath, ComponentType> = {
  "/": ApiProvidersPage,
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
  "/preference/config-backup": ConfigBackupPage,
  "/page-translation/custom-css": CustomCssPage,
  "/page-translation/prompts": PersonalizedPromptsPage,
  "/page-translation/auto-translate-websites": AutoTranslateWebsitesPage,
  "/page-translation/never-auto-translate-websites": NeverAutoTranslateWebsitesPage,
  "/page-translation/site-rules": SiteRulesPage,
}

function RouteLoadingFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      Loading settings...
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {ROUTE_DEFS.map(({ path }) => {
          const Component = ROUTE_COMPONENTS[path]
          return <Route key={path} path={path} element={<Component />} />
        })}
      </Routes>
    </Suspense>
  )
}
