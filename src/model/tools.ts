import { IS_MAC } from '../utils/platform'

/** 左クリック・左ドラッグの操作 */
export type Tool = 'draw' | 'erase' | 'pick' | 'move' | 'pan'

export interface ToolInfo {
  tool: Tool
  label: string
  /** 切り替えるキーの `KeyboardEvent.code` */
  code: string
  /** 切り替えるキーの表示名 */
  key: string
  /** ツールによらず使える一時的な操作 */
  alternative?: string
  /** macOS での一時的な操作の表示。省略時は `alternative` */
  macAlternative?: string
}

export const DEFAULT_TOOL: Tool = 'draw'

export const TOOLS: readonly ToolInfo[] = [
  { tool: 'draw', label: 'Draw', code: 'KeyB', key: 'B' },
  { tool: 'erase', label: 'Erase', code: 'KeyE', key: 'E', alternative: 'Right click' },
  {
    tool: 'pick',
    label: 'Pick shape and color',
    code: 'KeyI',
    key: 'I',
    alternative: 'Alt+click',
    macAlternative: 'Option+click',
  },
  { tool: 'move', label: 'Move layer', code: 'KeyV', key: 'V', alternative: 'Ctrl+drag', macAlternative: '⌘+drag' },
  { tool: 'pan', label: 'Pan', code: 'KeyH', key: 'H', alternative: 'Space+drag' },
]

/** ボタンのツールチップ。例: `Erase (E / Right click)` */
export function toolTitle(info: ToolInfo, mac = IS_MAC): string {
  const alternative = mac ? (info.macAlternative ?? info.alternative) : info.alternative
  return `${info.label} (${[info.key, alternative].filter(Boolean).join(' / ')})`
}

export function toolForKeyCode(code: string): Tool | undefined {
  return TOOLS.find((info) => info.code === code)?.tool
}

export function isTool(value: unknown): value is Tool {
  return TOOLS.some((info) => info.tool === value)
}
