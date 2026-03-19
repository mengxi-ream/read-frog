import type { ComponentType } from "react"
import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router"
import { ROUTE_DEFS } from "./app-sidebar/nav-items"
import { GeneralPage } from "./pages/general"

type RoutePath = (typeof ROUTE_DEFS)[number]["path"]

const ApiProvidersPage = lazy(() => import("./pages/api-providers").then(module => ({ default: module.ApiProvidersPage })))
const CustomActionsPage = lazy(() => import("./pages/custom-actions").then(module => ({ default: module.CustomActionsPage })))
const TranslationPage = lazy(() => import("./pages/translation").then(module => ({ default: module.TranslationPage })))
const VideoSubtitlesPage = lazy(() => import("./pages/video-subtitles").then(module => ({ default: module.VideoSubtitlesPage })))
const FloatingButtonPage = lazy(() => import("./pages/floating-button").then(module => ({ default: module.FloatingButtonPage })))
const SelectionToolbarPage = lazy(() => import("./pages/selection-toolbar").then(module => ({ default: module.SelectionToolbarPage })))
const ContextMenuPage = lazy(() => import("./pages/context-menu").then(module => ({ default: module.ContextMenuPage })))
const InputTranslationPage = lazy(() => import("./pages/input-translation").then(module => ({ default: module.InputTranslationPage })))
const TextToSpeechPage = lazy(() => import("./pages/text-to-speech").then(module => ({ default: module.TextToSpeechPage })))
const StatisticsPage = lazy(() => import("./pages/statistics").then(module => ({ default: module.StatisticsPage })))
const ConfigPage = lazy(() => import("./pages/config").then(module => ({ default: module.ConfigPage })))

const ROUTE_COMPONENTS: Record<RoutePath, ComponentType> = {
  "/": GeneralPage,
  "/api-providers": ApiProvidersPage,
  "/custom-actions": CustomActionsPage,
  "/translation": TranslationPage,
  "/video-subtitles": VideoSubtitlesPage,
  "/floating-button": FloatingButtonPage,
  "/selection-toolbar": SelectionToolbarPage,
  "/context-menu": ContextMenuPage,
  "/input-translation": InputTranslationPage,
  "/tts": TextToSpeechPage,
  "/statistics": StatisticsPage,
  "/config": ConfigPage,
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
