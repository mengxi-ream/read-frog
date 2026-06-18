export function getLobeIconsCDNUrlFn(iconSlug) {
    return (theme = "light") => {
        return `https://registry.npmmirror.com/@lobehub/icons-static-webp/1.65.0/files/${theme}/${iconSlug}.webp`;
    };
}
