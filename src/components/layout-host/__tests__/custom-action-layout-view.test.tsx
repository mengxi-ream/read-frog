// @vitest-environment jsdom
import type { LayoutViewProps } from "@read-frog/layout-engine/react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { loadLayoutMath } from "@/utils/layout-host/math"

const layoutViewProps = vi.fn<(props: LayoutViewProps) => void>()

vi.mock("@read-frog/layout-engine/react", () => ({
  LayoutView: (props: LayoutViewProps) => {
    layoutViewProps(props)
    return null
  },
}))

vi.mock("../use-extension-speak-adapter", () => ({
  useExtensionSpeakAdapter: () => ({
    adapter: { play: async () => {}, stop: () => {} },
    labels: {},
  }),
}))

const { CustomActionLayoutView } = await import("../custom-action-layout-view")

describe("customActionLayoutView", () => {
  afterEach(() => {
    cleanup()
    layoutViewProps.mockClear()
  })

  it("lets a layout draw formulas, loading Temml only when one has a formula", () => {
    render(
      <CustomActionLayoutView
        source='<p>{{ ["Formula"] | math }}</p>'
        outputSchema={[{ id: "f", name: "Formula", type: "string", description: "" }]}
        value={{ Formula: "\\(x^2\\)" }}
        selection=""
        targetCode="en"
        status="done"
        theme="light"
      />,
    )

    expect(layoutViewProps).toHaveBeenCalledWith(expect.objectContaining({ math: loadLayoutMath }))
  })
})
