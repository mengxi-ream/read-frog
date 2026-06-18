import { browser } from "#imports";
export async function openOptionsPage(options) {
    const route = options?.route ?? "";
    await browser.tabs.create({
        active: true,
        url: browser.runtime.getURL(`/options.html${route ? `#${route}` : ""}`),
    });
}
