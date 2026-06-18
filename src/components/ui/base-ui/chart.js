import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/utils/styles/utils";
// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" };
const CHART_ID_SANITIZER_REGEX = /:/g;
const ChartContext = React.createContext(null);
function useChart() {
    const context = React.use(ChartContext);
    if (!context) {
        throw new Error("useChart must be used within a <ChartContainer />");
    }
    return context;
}
function ChartContainer({ id, className, children, config, ...props }) {
    const uniqueId = React.useId();
    const chartId = `chart-${id || uniqueId.replace(CHART_ID_SANITIZER_REGEX, "")}`;
    return (_jsx(ChartContext, { value: { config }, children: _jsxs("div", { "data-slot": "chart", "data-chart": chartId, className: cn("flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden", className), ...props, children: [_jsx(ChartStyle, { id: chartId, config: config }), _jsx(RechartsPrimitive.ResponsiveContainer, { children: children })] }) }));
}
function ChartStyle({ id, config }) {
    const colorConfig = Object.entries(config).filter(([, config]) => config.theme || config.color);
    if (!colorConfig.length) {
        return null;
    }
    return (_jsx("style", { 
        // eslint-disable-next-line react/dom-no-dangerously-set-innerhtml
        dangerouslySetInnerHTML: {
            __html: Object.entries(THEMES)
                .map(([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
                .map(([key, itemConfig]) => {
                const color = itemConfig.theme?.[theme]
                    || itemConfig.color;
                return color ? `  --color-${key}: ${color};` : null;
            })
                .join("\n")}
}
`)
                .join("\n"),
        } }));
}
const ChartTooltip = RechartsPrimitive.Tooltip;
function ChartTooltipContent({ active, payload, className, indicator = "dot", hideLabel = false, hideIndicator = false, label, labelFormatter, labelClassName, formatter, color, nameKey, labelKey, valueFormatter, }) {
    const { config } = useChart();
    const tooltipLabel = React.useMemo(() => {
        if (hideLabel || !payload?.length) {
            return null;
        }
        const [item] = payload;
        const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);
        const value = !labelKey && typeof label === "string"
            ? config[label]?.label || label
            : itemConfig?.label;
        if (labelFormatter) {
            return (_jsx("div", { className: cn("font-medium", labelClassName), children: labelFormatter(value, payload) }));
        }
        if (!value) {
            return null;
        }
        return _jsx("div", { className: cn("font-medium", labelClassName), children: value });
    }, [
        label,
        labelFormatter,
        payload,
        hideLabel,
        labelClassName,
        config,
        labelKey,
    ]);
    if (!active || !payload?.length) {
        return null;
    }
    const nestLabel = payload.length === 1 && indicator !== "dot";
    return (_jsxs("div", { className: cn("border-border/50 bg-background gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl grid min-w-32 items-start", className), children: [!nestLabel ? tooltipLabel : null, _jsx("div", { className: "grid gap-1.5", children: payload
                    .filter((item) => item.type !== "none")
                    .map((item, index) => {
                    const key = `${nameKey || item.name || item.dataKey || "value"}`;
                    const itemConfig = getPayloadConfigFromPayload(config, item, key);
                    const indicatorColor = color || item.payload?.fill || item.color;
                    const tooltipItemKey = typeof item.dataKey === "string" || typeof item.dataKey === "number"
                        ? item.dataKey
                        : item.name ?? index;
                    return (_jsx("div", { className: cn("flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground", indicator === "dot" && "items-center"), children: formatter && item?.value !== undefined && item.name
                            ? (formatter(item.value, item.name, item, index, payload))
                            : (_jsxs(_Fragment, { children: [itemConfig?.icon
                                        ? (_jsx(itemConfig.icon, {}))
                                        : (!hideIndicator && (_jsx("div", { className: cn("shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)", {
                                                "h-2.5 w-2.5": indicator === "dot",
                                                "w-1": indicator === "line",
                                                "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                                                "my-0.5": nestLabel && indicator === "dashed",
                                            }), style: {
                                                "--color-bg": indicatorColor,
                                                "--color-border": indicatorColor,
                                            } }))), _jsxs("div", { className: cn("flex flex-1 justify-between leading-none", nestLabel ? "items-end" : "items-center"), children: [_jsxs("div", { className: "grid gap-1.5", children: [nestLabel ? tooltipLabel : null, _jsx("span", { className: "text-muted-foreground", children: itemConfig?.label || item.name })] }), item.value && (_jsx("span", { className: "font-mono font-medium text-foreground tabular-nums", children: valueFormatter
                                                    ? valueFormatter(item.value)
                                                    : item.value.toLocaleString() }))] })] })) }, tooltipItemKey));
                }) })] }));
}
const ChartLegend = RechartsPrimitive.Legend;
function ChartLegendContent({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey, }) {
    const { config } = useChart();
    if (!payload?.length) {
        return null;
    }
    return (_jsx("div", { className: cn("flex items-center justify-center gap-4", verticalAlign === "top" ? "pb-3" : "pt-3", className), children: payload
            .filter((item) => item.type !== "none")
            .map((item, index) => {
            const key = `${nameKey || item.dataKey || "value"}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const legendItemKey = typeof item.dataKey === "string" || typeof item.dataKey === "number"
                ? item.dataKey
                : item.value ?? index;
            return (_jsxs("div", { className: cn("flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"), children: [itemConfig?.icon && !hideIcon
                        ? (_jsx(itemConfig.icon, {}))
                        : (_jsx("div", { className: "h-2 w-2 shrink-0 rounded-[2px]", style: {
                                backgroundColor: item.color,
                            } })), itemConfig?.label] }, legendItemKey));
        }) }));
}
function getPayloadConfigFromPayload(config, payload, key) {
    if (typeof payload !== "object" || payload === null) {
        return undefined;
    }
    const payloadPayload = "payload" in payload
        && typeof payload.payload === "object"
        && payload.payload !== null
        ? payload.payload
        : undefined;
    let configLabelKey = key;
    if (key in payload
        && typeof payload[key] === "string") {
        configLabelKey = payload[key];
    }
    else if (payloadPayload
        && key in payloadPayload
        && typeof payloadPayload[key] === "string") {
        configLabelKey = payloadPayload[key];
    }
    return configLabelKey in config
        ? config[configLabelKey]
        : config[key];
}
export { ChartContainer, ChartLegend, ChartLegendContent, ChartStyle, ChartTooltip, ChartTooltipContent, };
