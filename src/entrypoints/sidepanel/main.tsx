import { browser } from "#imports"

window.location.replace(
  browser.runtime.getURL("/translation-hub.html?embedded=side-panel"),
)
