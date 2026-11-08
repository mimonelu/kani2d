import { describe, expect, it } from 'vitest'
import { DEFAULT_COLOR, PALETTE, hexToRgb, rgbToHex } from './palette'

describe('palette', () => {
  it('has 125 unique colors made of 5 levels per channel', () => {
    expect(PALETTE).toHaveLength(125)
    expect(new Set(PALETTE).size).toBe(125)
    for (const color of PALETTE) {
      for (const value of hexToRgb(color)) {
        expect([0, 64, 128, 192, 255]).toContain(value)
      }
    }
  })

  it('includes white as the default color', () => {
    expect(DEFAULT_COLOR).toBe('#FFFFFF')
    expect(PALETTE).toContain(DEFAULT_COLOR)
    expect(PALETTE[0]).toBe('#000000')
    expect(PALETTE[124]).toBe('#FFFFFF')
  })

  it('converts between hex and rgb', () => {
    expect(rgbToHex(0, 64, 255)).toBe('#0040FF')
    expect(hexToRgb('#0040FF')).toEqual([0, 64, 255])
  })
})
