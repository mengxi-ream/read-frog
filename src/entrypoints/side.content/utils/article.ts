/**
 * 扁平化提取"块级叶子"中的文本段落，并返回扁平化后的文本数组。
 * @param {Node} root - 文章主体容器
 * @returns {string[]} 扁平化后的文本字符串数组
 */
export function flattenToParagraphs(root: Node) {
  // —— 1. 定义哪些标签（或 computedStyle）算"块级"
  const semanticBlocks = new Set([
    "p",
    "article",
    "section",
    "figure",
    "figcaption",
    "blockquote",
    "pre",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "div",
    "header",
    "footer",
    "main",
    "nav",
  ]);

  function isBlockLevel(node: Node): boolean {
    // 只有元素节点才能是块级
    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const el = node as Element;
    // 如果标签名在列表里，或者 computedStyle.display=block
    if (semanticBlocks.has(el.tagName.toLowerCase())) return true;
    const disp = window.getComputedStyle(el).display;
    return disp === "block" || disp === "list-item";
  }

  function hasBlockDescendant(node: Node): boolean {
    // 非元素节点不会有块级后代
    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const el = node as Element;
    // 检查子孙是否存在任一块级元素
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      if (isBlockLevel(child) || hasBlockDescendant(child)) {
        return true;
      }
    }
    return false;
  }

  const paragraphs: string[] = [];

  // 获取元素的文本内容，同时考虑内联元素之间的空格
  function getTextWithSpaces(element: Element): string {
    let text = "";

    // 为每个子节点递归处理
    for (const child of element.childNodes) {
      let childText = "";
      if (child.nodeType === Node.TEXT_NODE) {
        childText = child.textContent || "";
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        childText = getTextWithSpaces(child as Element);
      }
      if (
        text.length > 0 &&
        !text.endsWith(" ") &&
        !/[.!?,:;'"…)}\]]$/.test(childText)
      ) {
        text += " ";
      }
      text += childText;
      // if (child.nodeType === Node.TEXT_NODE) {
      //   // 文本节点直接添加
      //   text += child.textContent || "";
      // } else if (child.nodeType === Node.ELEMENT_NODE) {
      //   const childEl = child as Element;
      //   // 防止在已有空格的地方添加额外空格
      //   if (text.length > 0 && !text.endsWith(" ")) {
      //     text += " ";
      //   }
      //   text += getTextWithSpaces(childEl);
      //   // 在内联元素后添加空格，如果不是已以空格结尾且不是标点符号结尾
      //   if (!text.endsWith(" ") && !/[.!?,:;'"…)}\]]$/.test(text)) {
      //     text += " ";
      //   }
      // }
    }

    return text;
  }

  function walk(node: Node) {
    // 跳过注释节点、处理指令等非内容节点
    if (
      node.nodeType !== Node.ELEMENT_NODE &&
      node.nodeType !== Node.TEXT_NODE
    ) {
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      // 如果它是一个"块级叶子"，就提取成段落；否则下降
      if (isBlockLevel(element) && !hasBlockDescendant(element)) {
        // 使用新的方法获取文本，保留内联元素之间的空格
        const raw = getTextWithSpaces(element).replace(/\s+/g, " ").trim();
        if (raw?.length && raw.length > 20) {
          // 可根据需求调整最小长度过滤
          paragraphs.push(raw);
        }
      } else {
        // 继续遍历子节点
        for (const child of element.childNodes) {
          walk(child);
        }
      }
    }
    // 如果是文本节点，且其父容器也不是"块级叶子"时，可以视作一个独立段落
    else if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent?.replace(/\s+/g, " ").trim();
      if (txt?.length && txt.length > 20) {
        paragraphs.push(txt);
      }
    }
  }

  // 从 root 开始遍历
  walk(root);

  // 返回段落数组
  return paragraphs;
}

export function extractSeoInfo(doc: Document) {
  const seoInfo = {
    title: doc.title || "",
    metaDescription:
      doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
      "",
    metaKeywords:
      doc.querySelector('meta[name="keywords"]')?.getAttribute("content") || "",
    canonicalUrl:
      doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
    ogTitle:
      doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      "",
    ogDescription:
      doc
        .querySelector('meta[property="og:description"]')
        ?.getAttribute("content") || "",
    ogImage:
      doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
      "",
    twitterCard:
      doc.querySelector('meta[name="twitter:card"]')?.getAttribute("content") ||
      "",
    twitterTitle:
      doc
        .querySelector('meta[name="twitter:title"]')
        ?.getAttribute("content") || "",
    h1Tags: Array.from(doc.querySelectorAll("h1")).map(
      (h) => h.textContent?.trim() || "",
    ),
    structuredData: Array.from(
      doc.querySelectorAll('script[type="application/ld+json"]'),
    ).map((script) => {
      try {
        return JSON.parse(script.textContent || "{}");
      } catch (e) {
        console.error("Error parsing structured data:", e);
        return {};
      }
    }),
  };

  return seoInfo;
}
