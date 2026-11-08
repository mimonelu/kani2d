export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/** HSL（色相は度、彩度・輝度は %）を 8bit の RGB に変換する */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const saturation = s / 100
  const lightness = l / 100
  const a = saturation * Math.min(lightness, 1 - lightness)
  const channel = (n: number): number => {
    const k = (n + h / 30) % 12
    const value = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(value * 255)
  }
  return [channel(0), channel(8), channel(4)]
}

export const COLOR_PATTERN = /^#[0-9A-F]{6}$/

/** パレットの 1 行あたりの色数 */
export const PALETTE_COLUMNS = 12

const PALETTE_HUES: readonly number[] = Array.from({ length: PALETTE_COLUMNS }, (_, i) => i * 30)
const PALETTE_SATURATION = 90
const PALETTE_LIGHTNESS: readonly number[] = [85, 70, 52, 36, 20]

/** 白から黒までのグレー */
export const GRAY_COLORS: readonly string[] = Array.from({ length: PALETTE_COLUMNS }, (_, i) => {
  const value = Math.round(255 - (255 * i) / (PALETTE_COLUMNS - 1))
  return rgbToHex(value, value, value)
})

/** 行ごとに輝度を固定し、色相を赤から 30° ずつ並べた色 */
export const HUE_COLORS: readonly string[] = PALETTE_LIGHTNESS.flatMap((l) =>
  PALETTE_HUES.map((h) => rgbToHex(...hslToRgb(h, PALETTE_SATURATION, l))),
)

export const PALETTE: readonly string[] = [...GRAY_COLORS, ...HUE_COLORS]

export const DEFAULT_COLOR = '#FFFFFF'
