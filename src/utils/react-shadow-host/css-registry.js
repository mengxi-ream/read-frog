import { Sha256Hex } from "../hash";
export class CSSRegistry {
    registry = new Map();
    static hash(content) {
        return Sha256Hex(content);
    }
    inject(css) {
        const key = CSSRegistry.hash(css);
        const existing = this.registry.get(key);
        if (existing) {
            existing.count += 1;
            return key;
        }
        const style = document.createElement("style");
        style.textContent = css;
        style.setAttribute("data-read-frog-react-shadow-css-key", key);
        document.head.appendChild(style);
        this.registry.set(key, { node: style, count: 1 });
        return key;
    }
    /** Caller must return the key when unloading, and do reference count decrement */
    remove(key) {
        const entry = this.registry.get(key);
        if (!entry)
            return;
        entry.count -= 1;
        if (entry.count === 0) {
            entry.node.remove();
            this.registry.delete(key);
        }
    }
}
/* Singleton */
export const cssRegistry = new CSSRegistry();
