// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { Link, MemoryRouter, Route, Routes, useNavigationType } from "react-router"
import { describe, expect, it } from "vitest"
import { DRILL_IN_LOCATION_STATE, useDrillInBack } from "../drill-in"

function DetailPage() {
  const goBack = useDrillInBack()
  return (
    <Link to="/preference" onClick={goBack}>
      back
    </Link>
  )
}

/** The navigation type is what `ScrollRestoration` branches on: POP restores, PUSH goes to top. */
function ParentPage() {
  return <div>{`parent:${useNavigationType()}`}</div>
}

function renderDetailPage({ drilledIn }: { drilledIn: boolean }) {
  const detailEntry = { pathname: "/preference/config-backup" }
  return render(
    <MemoryRouter
      initialEntries={
        drilledIn
          ? [{ pathname: "/preference" }, { ...detailEntry, state: DRILL_IN_LOCATION_STATE }]
          : [detailEntry]
      }
      initialIndex={drilledIn ? 1 : 0}
    >
      <Routes>
        <Route path="/preference" element={<ParentPage />} />
        <Route path="/preference/config-backup" element={<DetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("useDrillInBack", () => {
  it("pops the drill-in entry so the parent page can restore its scroll offset", () => {
    renderDetailPage({ drilledIn: true })

    fireEvent.click(screen.getByRole("link", { name: "back" }))

    expect(screen.getByText("parent:POP")).toBeTruthy()
  })

  it("navigates normally when the detail page was not drilled into", () => {
    renderDetailPage({ drilledIn: false })

    fireEvent.click(screen.getByRole("link", { name: "back" }))

    expect(screen.getByText("parent:PUSH")).toBeTruthy()
  })

  it("leaves modified clicks to the browser", () => {
    renderDetailPage({ drilledIn: true })

    fireEvent.click(screen.getByRole("link", { name: "back" }), { metaKey: true })

    expect(screen.getByRole("link", { name: "back" })).toBeTruthy()
  })
})
