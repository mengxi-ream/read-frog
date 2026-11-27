/**
 * Whether the browser has a panel the extension can open beside the page:
 * Chrome's and Edge's side panel, or Firefox's sidebar. Safari has neither,
 * and its build leaves the panel page out.
 */
export function hasSidePanel(): boolean {
  return import.meta.env.BROWSER !== "safari"
}
