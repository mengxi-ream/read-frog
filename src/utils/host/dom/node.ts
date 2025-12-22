export function getOwnerDocument(node: Node): Document {
  return node.ownerDocument || document
}

export function getContainingShadowRoot(node: Node): ShadowRoot | null {
  const root = node.getRootNode()
  return root instanceof ShadowRoot ? root : null
}
