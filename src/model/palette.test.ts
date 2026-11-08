import { describe, expect, it } from 'vitest'
import {
  COLOR_PATTERN,
  DEFAULT_COLOR,
  GRAY_COLORS,
  HUE_COLORS,
  PALETTE,
  PALETTE_COLUMNS,
  hexToRgb,
  hslToRgb,
  rgbToHex,
} from './palette'

describe('palette', () => {
  it('has 72 unique colors: a gray row and 5 rows of 12 hues', () => {
    expect(GRAY_COLORS).toHaveLength(PALETTE_COLUMNS)
    expect(HUE_COLORS).toHaveLength(PALETTE_COLUMNS * 5)
    expect(PALETTE).toEqual([...GRAY_COLORS, ...HUE_COLORS])
    expect(new Set(PALETTE).size).toBe(72)
    for (const color of PALETTE) expect(color).toMatch(COLOR_PATTERN)
  })

  it('orders the grays from white to black', () => {
    expect(GRAY_COLORS[0]).toBe('#FFFFFF')
    expect(GRAY_COLORS[PALETTE_COLUMNS - 1]).toBe('#000000')
    const values = GRAY_COLORS.map((color) => {
      const [r, g, b] = hexToRgb(color)
      expect(g).toBe(r)
      expect(b).toBe(r)
      return r
    })
    expect(values).toEqual([...values].sort((a, b) => b - a))
  })

  it('arranges hues from red in 30-degree steps, lightest row first', () => {
    // 輝度 52% の行の赤・緑・青
    expect(HUE_COLORS[PALETTE_COLUMNS * 2]).toBe('#F31616')
    expect(HUE_COLORS[PALETTE_COLUMNS * 2 + 4]).toBe('#16F316')
    expect(HUE_COLORS[PALETTE_COLUMNS * 2 + 8]).toBe('#1616F3')
    expect(HUE_COLORS[0]).toBe('#FBB6B6')
    expect(HUE_COLORS[PALETTE_COLUMNS * 5 - 1]).toBe('#610533')
  })

  it('includes white as the default color', () => {
    expect(DEFAULT_COLOR).toBe('#FFFFFF')
    expect(PALETTE).toContain(DEFAULT_COLOR)
  })

  it('converts between hex, rgb and hsl', () => {
    expect(rgbToHex(0, 64, 255)).toBe('#0040FF')
    expect(hexToRgb('#0040FF')).toEqual([0, 64, 255])
    expect(hslToRgb(0, 100, 50)).toEqual([255, 0, 0])
    expect(hslToRgb(120, 100, 50)).toEqual([0, 255, 0])
    expect(hslToRgb(240, 100, 50)).toEqual([0, 0, 255])
    expect(hslToRgb(0, 0, 100)).toEqual([255, 255, 255])
  })
})
