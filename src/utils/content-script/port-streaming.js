import { browser } from "#imports";
import { getRandomUUID } from "@/utils/crypto-polyfill";
/**
 * Handles cleanup, abort signals, and disconnection automatically
 */
export function createPortStreamPromise(portName, serializablePayload, options = {}) {
    return new Promise((resolve, reject) => {
        const { signal, onChunk, keepAliveIntervalMs = 20_000, } = options;
        const requestId = getRandomUUID();
        const port = browser.runtime.connect({ name: portName });
        let settled = false;
        let messageListener;
        let disconnectListener;
        let abortListener;
        let keepAliveTimer;
        const cleanup = () => {
            if (messageListener) {
                port.onMessage.removeListener(messageListener);
            }
            if (disconnectListener) {
                port.onDisconnect.removeListener(disconnectListener);
            }
            if (abortListener && signal) {
                signal.removeEventListener("abort", abortListener);
            }
            if (keepAliveTimer) {
                clearInterval(keepAliveTimer);
                keepAliveTimer = undefined;
            }
        };
        const finalize = (callback) => {
            if (settled) {
                return;
            }
            settled = true;
            try {
                port.disconnect();
            }
            catch {
                // The port may already be closed due to a race with onDisconnect.
                // This is expected during cleanup and safe to ignore.
            }
            callback();
            cleanup();
        };
        messageListener = (event) => {
            if (!event || event.requestId !== requestId) {
                return;
            }
            if (event.type === "chunk") {
                onChunk?.(event.data);
                return;
            }
            if (event.type === "done") {
                finalize(() => resolve(event.data));
                return;
            }
            if (event.type === "error") {
                finalize(() => reject(new Error(event.error.message)));
            }
        };
        disconnectListener = () => {
            finalize(() => reject(new Error("Stream disconnected unexpectedly")));
        };
        abortListener = () => {
            finalize(() => reject(new DOMException("aborted", "AbortError")));
        };
        if (signal?.aborted) {
            abortListener();
            return;
        }
        port.onMessage.addListener(messageListener);
        port.onDisconnect.addListener(disconnectListener);
        if (signal) {
            signal.addEventListener("abort", abortListener);
        }
        const startMessage = {
            type: "start",
            requestId,
            payload: serializablePayload,
        };
        port.postMessage(startMessage);
        if (keepAliveIntervalMs > 0) {
            keepAliveTimer = setInterval(() => {
                if (settled) {
                    return;
                }
                try {
                    const pingMessage = {
                        type: "ping",
                        requestId,
                    };
                    port.postMessage(pingMessage);
                }
                catch {
                    // Ignore keepalive send failures; disconnect listener will handle it.
                }
            }, keepAliveIntervalMs);
        }
    });
}
