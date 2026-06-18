export function getOwnerDocument(node) {
    return node.ownerDocument || document;
}
export function getContainingShadowRoot(node) {
    const root = node.getRootNode();
    return root instanceof ShadowRoot ? root : null;
}
