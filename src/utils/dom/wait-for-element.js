const WAIT_TIMEOUT = 10000;
export function waitForElement(selector, validate) {
    return new Promise((resolve) => {
        const tryFind = () => {
            const element = document.querySelector(selector);
            if (element && (!validate || validate(element))) {
                return element;
            }
            return null;
        };
        const found = tryFind();
        if (found) {
            resolve(found);
            return;
        }
        const observer = new MutationObserver(() => {
            const found = tryFind();
            if (found) {
                observer.disconnect();
                resolve(found);
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, WAIT_TIMEOUT);
    });
}
