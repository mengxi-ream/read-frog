import type { ComponentType } from "react"
import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router"
import { ROUTE_DEFS } from "./app-sidebar/nav-items"
import { GeneralPage } from "./pages/general"

type RoutePath = (typeof ROUTE_DEFS)[number]["path"]

const ApiProvidersPage = lazy(() => import("./pages/api-providers").then(module => ({ default: module.ApiProvidersPage })))
const TranslationPage = lazy(() => import("./pages/translation").then(module => ({ default: module.TranslationPage })))
const ContextMenuPage = lazy(() => import("./pages/context-menu").then(module => ({ default: module.ContextMenuPage })))
const ConfigPage = lazy(() => import("./pages/config").then(module => ({ default: module.ConfigPage })))

const ROUTE_COMPONENTS: Record<RoutePath, ComponentType> = {
  "/": GeneralPage,
  "/api-providers": ApiProvidersPage,
  "/translation": TranslationPage,
  "/context-menu": ContextMenuPage,
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
