/* eslint-disable no-console */
/* ──────────────  logger.ts  ────────────── */

const isDev = import.meta.env.DEV

/** ANSI 颜色码（Node 控制台） */
const ansi = {
  reset: '\x1B[0m',
  gray: '\x1B[90m',
  blue: '\x1B[34m',
  yellow: '\x1B[33m',
  red: '\x1B[31m',
}

/** 浏览器 %c 样式 */
const css = {
  gray: 'color:#aaa',
  blue: 'color:#2196f3',
  yellow: 'color:#ffb300',
  red: 'color:#f44336',
}

type Level = 'log' | 'info' | 'warn' | 'error'

function format(level: Level, msgs: any[]) {
  const prefix = '[dev-log]'
  // Node 环境 → 用 ANSI；否则用浏览器 %c
  const useAnsi = typeof window === 'undefined'

  const color = {
    log: useAnsi ? ansi.gray : css.gray,
    info: useAnsi ? ansi.blue : css.blue,
    warn: useAnsi ? ansi.yellow : css.yellow,
    error: useAnsi ? ansi.red : css.red,
  }[level]

  if (useAnsi) {
    return [`${color}${prefix}${ansi.reset}`, ...msgs]
  }
  return [`%c${prefix}`, color, ...msgs]
}

export const logger = {
  log: (...m: any[]) => isDev && console.log(...format('log', m)),
  info: (...m: any[]) => isDev && console.info(...format('info', m)),
  warn: (...m: any[]) => isDev && console.warn(...format('warn', m)),
  error: (...m: any[]) => isDev && console.error(...format('error', m)),
}
