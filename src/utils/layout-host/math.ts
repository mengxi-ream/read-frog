import type { LayoutMath } from "@read-frog/layout-engine/core"

let loading: Promise<LayoutMath> | null = null

/**
 * What draws the formulas of a custom action's layout (its `math` and `latex`
 * filters), with Temml. A layout calls it the first time it has a formula to
 * draw and shows placeholders until then, so Temml loads only for layouts
 * that use formulas. A failed load leaves those formulas as their LaTeX
 * source, and the next layout that needs it tries again.
 *
 * Formulas use the system's math font: a font declared inside the layout's
 * shadow root is unreliable, and the extension does not add one to the page.
 */
export function loadLayoutMath(): Promise<LayoutMath> {
  loading ??= import("@read-frog/layout-engine/math").then(
    ({ createLayoutMath }) => createLayoutMath(),
    (error: unknown) => {
      loading = null
      throw error
    },
  )
  return loading
}
