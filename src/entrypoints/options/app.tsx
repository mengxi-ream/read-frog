import { Navigate, Route, Routes } from "react-router"
import { ROUTE_CONFIG } from "./app-sidebar/nav-items"

export default function App() {
  return (
    <Routes>
      {ROUTE_CONFIG.map(({ path, component: Component }) => (
        <Route key={path} path={path} element={<Component />} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
