export function getActiveTabUrl() {
  return browser.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0].url)
}
