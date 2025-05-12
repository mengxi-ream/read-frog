export default defineBackground(() => {
  logger.info("Hello background!", { id: browser.runtime.id });

  browser.runtime.onInstalled.addListener(async () => {
    await storage.setItem<number>("local:__configSchemaVersion", 1);
    await initializeConfig();
  });

  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "openOptionsPage") {
      browser.runtime.openOptionsPage();
    }
  });
});
