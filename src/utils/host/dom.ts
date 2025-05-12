import { FORCE_BLOCK_TAGS } from "../constants/dom";

export function isEditable(el: HTMLElement) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function deepElementFromPoint(
  root: Document | ShadowRoot,
  x: number,
  y: number,
) {
  // 第一步：在当前 root（Document 或 ShadowRoot）里拿第一级命中
  const el = root.elementFromPoint(x, y);
  // 如果这个元素有 open shadowRoot，继续在它的 shadowRoot 里查
  if (el && el.shadowRoot) {
    return deepElementFromPoint(el.shadowRoot, x, y);
  }
  // 否则，el 就是我们想要的最深层元素
  return el;
}

export function selectNode(mouseX: number, mouseY: number) {
  // 1. if not block node, find up to the block node
  let currentNode = deepElementFromPoint(document, mouseX, mouseY);

  while (
    currentNode &&
    (window.getComputedStyle(currentNode).display.includes("inline") ||
      currentNode.className.includes("notranslate"))
  ) {
    if (FORCE_BLOCK_TAGS.has(currentNode.tagName)) {
      break;
    }
    currentNode = currentNode.parentElement;
  }

  return currentNode;
}

export function smashTruncationStyle(node: HTMLElement) {
  if (node.style && node.style.webkitLineClamp !== undefined) {
    node.style.webkitLineClamp = "unset";
  }
  if (node.style && node.style.maxHeight !== undefined) {
    node.style.maxHeight = "unset";
  }
}

export function getTextContent(node: HTMLElement): string {
  if (!node) return "";

  // Skip if the node has sr-only class
  if (node.classList.contains("sr-only")) {
    return "";
  }

  // Get all child nodes
  const childNodes = Array.from(node.childNodes);

  return childNodes.reduce((text: string, child: Node): string => {
    // If it's a text node, add its content
    if (child.nodeType === Node.TEXT_NODE) {
      return text + child.textContent;
    }

    // If it's an element node, recursively get its text content
    if (child instanceof HTMLElement && child.nodeType === Node.ELEMENT_NODE) {
      return text + getTextContent(child);
    }

    return text;
  }, "");
}
