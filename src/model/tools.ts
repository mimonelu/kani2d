/** 左クリック・左ドラッグの操作 */
export type Tool = 'draw' | 'erase' | 'pick' | 'pan'

export interface ToolInfo {
  tool: Tool
  label: string
  /** 切り替えるキーの `KeyboardEvent.code` */
  code: string
  /** 切り替えるキーの表示名 */
  key: string
  /** ツールによらず使える一時的な操作 */
  alternative?: string
}

export const DEFAULT_TOOL: Tool = 'draw'

export const TOOLS: readonly ToolInfo[] = [
  { tool: 'draw', label: 'Draw', code: 'KeyB', key: 'B' },
  { tool: 'erase', label: 'Erase', code: 'KeyE', key: 'E', alternative: 'Right click' },
  { tool: 'pick', label: 'Pick shape and color', code: 'KeyI', key: 'I', alternative: 'Alt+click' },
  { tool: 'pan', label: 'Pan', code: 'KeyH', key: 'H', alternative: 'Space+drag' },
]

/** ボタンのツールチップ。例: `Erase (E / Right click)` */
export function toolTitle(info: ToolInfo): string {
  return `${info.label} (${[info.key, info.alternative].filter(Boolean).join(' / ')})`
}

export function toolForKeyCode(code: string): Tool | undefined {
  return TOOLS.find((info) => info.code === code)?.tool
}

export function isTool(value: unknown): value is Tool {
  return TOOLS.some((info) => info.tool === value)
}
