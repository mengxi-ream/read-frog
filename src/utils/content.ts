/**
 * 获取页面 favicon 的最通用方法
 * @return {string} favicon 的 URL
 */
export function getFaviconUrl() {
  // 优先级列表：常见 rel 属性
  const relList = [
    "icon",
    "shortcut icon",
    "apple-touch-icon",
    "apple-touch-icon-precomposed",
    "mask-icon",
  ];

  const candidates: { url: string; size: number; type: string }[] = [];

  for (const rel of relList) {
    const links = document.head.querySelectorAll(
      `link[rel="${rel}"]`,
    ) as NodeListOf<HTMLLinkElement>;

    links.forEach((link) => {
      if (link.href) {
        const size =
          link.sizes.length > 0
            ? Math.max(...Array.from(link.sizes).map((s) => parseInt(s) || 0))
            : 0;

        candidates.push({
          url: link.href,
          size,
          type: link.type || "",
        });
      }
    });
  }

  // 按以下优先级排序：
  // 1. 更大的尺寸优先
  // 2. SVG 格式优先（通常更清晰）
  // 3. PNG 格式优先于 ICO
  candidates.sort((a, b) => {
    if (a.size !== b.size) return b.size - a.size;
    if (a.type === "image/svg+xml" && b.type !== "image/svg+xml") return -1;
    if (b.type === "image/svg+xml" && a.type !== "image/svg+xml") return 1;
    if (a.type === "image/png" && b.type === "image/x-icon") return -1;
    if (b.type === "image/png" && a.type === "image/x-icon") return 1;
    return 0;
  });

  // 如果找到了候选图标，返回最优的那个
  if (candidates.length > 0) {
    return candidates[0].url;
  }

  // 如果依然没找到，就回退到站点根目录的 /favicon.ico
  const { origin } = window.location;
  return origin + "/favicon.ico";
}
