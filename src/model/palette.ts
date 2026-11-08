export const PALETTE_LEVELS: readonly number[] = [0, 64, 128, 192, 255]

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

export const COLOR_PATTERN = /^#[0-9A-F]{6}$/

/** R を最上位、B を最下位として並べた全 125 色 */
export const PALETTE: readonly string[] = PALETTE_LEVELS.flatMap((r) =>
  PALETTE_LEVELS.flatMap((g) => PALETTE_LEVELS.map((b) => rgbToHex(r, g, b))),
)

export const DEFAULT_COLOR = '#FFFFFF'
