import { describe, expect, it } from 'vitest'
import type { SerializedTile } from './fileFormat'
import { rasterize, type RasterOutput } from './raster'
import { Shape } from './types'

function pixel(output: RasterOutput, x: number, y: number): number[] {
  const i = (y * output.width + x) * 4
  return [...output.data.slice(i, i + 4)]
}

function alphaCount(output: RasterOutput, predicate: (a: number) => boolean): number {
  let count = 0
  for (let i = 3; i < output.data.length; i += 4) if (predicate(output.data[i]!)) count++
  return count
}

function render(layers: SerializedTile[][], tileSize: number, antialias: boolean, width = 1, height = 1) {
  return rasterize({ width, height, layers, tileSize, antialias })
}

describe('rasterize', () => {
  it('outputs canvas size times tile size with a transparent background', () => {
    const output = render([[[1, 0, '#FF0000', Shape.Square]]], 4, false, 3, 2)
    expect(output.width).toBe(12)
    expect(output.height).toBe(8)
    expect(pixel(output, 0, 0)).toEqual([0, 0, 0, 0])
    expect(pixel(output, 4, 0)).toEqual([255, 0, 0, 255])
    expect(pixel(output, 7, 3)).toEqual([255, 0, 0, 255])
    expect(pixel(output, 8, 0)).toEqual([0, 0, 0, 0])
  })

  it('draws symmetric triangles without anti-aliasing', () => {
    const s = 8
    const shapes = [Shape.TopLeft, Shape.TopRight, Shape.BottomRight, Shape.BottomLeft]
    const counts = shapes.map((shape) => alphaCount(render([[[0, 0, '#FFFFFF', shape]]], s, false), (a) => a === 255))
    // 対角線上のピクセルを含む
    expect(counts).toEqual(Array(4).fill((s * (s + 1)) / 2))
    const topLeft = render([[[0, 0, '#FFFFFF', Shape.TopLeft]]], s, false)
    expect(pixel(topLeft, 0, 0)[3]).toBe(255)
    expect(pixel(topLeft, s - 1, s - 1)[3]).toBe(0)
    expect(alphaCount(topLeft, (a) => a !== 0 && a !== 255)).toBe(0)
  })

  it('anti-aliases only the diagonal with exactly half coverage', () => {
    const s = 8
    const output = render([[[0, 0, '#FFFFFF', Shape.TopLeft]]], s, true)
    for (let i = 0; i < s; i++) {
      expect(pixel(output, i, s - 1 - i)).toEqual([255, 255, 255, 128])
    }
    expect(alphaCount(output, (a) => a === 255)).toBe((s * (s - 1)) / 2)
    const main = render([[[0, 0, '#FFFFFF', Shape.TopRight]]], s, true)
    for (let i = 0; i < s; i++) expect(pixel(main, i, i)[3]).toBe(128)
  })

  it.each([false, true])('leaves no gaps between complementary triangles (antialias: %s)', (antialias) => {
    const pairs = [
      [Shape.TopLeft, Shape.BottomRight],
      [Shape.TopRight, Shape.BottomLeft],
    ]
    for (const [a, b] of pairs) {
      const output = render([[[0, 0, '#FF0000', a!]], [[0, 0, '#FF0000', b!]]], 8, antialias)
      expect(alphaCount(output, (alpha) => alpha === 255)).toBe(64)
      for (let i = 0; i < output.data.length; i += 4) {
        expect([...output.data.slice(i, i + 3)]).toEqual([255, 0, 0])
      }
    }
  })

  it('draws upper layers in front and hides layers below a square', () => {
    const output = render([[[0, 0, '#0000FF', Shape.Square]], [[0, 0, '#FF0000', Shape.TopLeft]]], 4, false)
    expect(pixel(output, 0, 0)).toEqual([255, 0, 0, 255])
    expect(pixel(output, 3, 3)).toEqual([0, 0, 255, 255])
    const covered = render([[[0, 0, '#0000FF', Shape.TopLeft]], [[0, 0, '#FF0000', Shape.Square]]], 4, true)
    expect(alphaCount(covered, (a) => a === 255)).toBe(16)
    expect(pixel(covered, 0, 0)).toEqual([255, 0, 0, 255])
  })

  it('blends colors on the diagonal when anti-aliased', () => {
    const output = render([[[0, 0, '#0000FF', Shape.BottomRight]], [[0, 0, '#FF0000', Shape.TopLeft]]], 4, true)
    expect(pixel(output, 0, 3)).toEqual([128, 0, 128, 255])
  })
})
