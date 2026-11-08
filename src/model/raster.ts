import type { SerializedTile } from './fileFormat'
import { hexToRgb } from './palette'
import { Shape } from './types'

export interface RasterInput {
  /** 幅（マス） */
  width: number
  /** 高さ（マス） */
  height: number
  /** 背面から前面の順に並べた各レイヤーのタイル */
  layers: SerializedTile[][]
  /** 1 マスあたりのピクセル数 */
  tileSize: number
  antialias: boolean
}

export interface RasterOutput {
  width: number
  height: number
  /** RGBA 各 8bit、ストレートアルファ */
  data: Uint8ClampedArray<ArrayBuffer>
}

interface StackEntry {
  r: number
  g: number
  b: number
  shape: Shape
}

/**
 * 対角線上のサンプルをどちらの三角形に含めるか
 * - Both: 両方に含める（アンチエイリアス無効時に形状を左右対称にするため）
 * - First: 左上・右上に含める
 * - Second: 右下・左下に含める
 */
const Tie = { Both: 0, First: 1, Second: 2 } as const
type Tie = (typeof Tie)[keyof typeof Tie]

/** 1 辺あたりのサンプル数 */
const SUPERSAMPLE = 4

/**
 * マス内座標 (u, v) がタイル形状に含まれるか。座標と辺の長さ s は同じ整数単位で表す
 * - 左上・右下は反対角線 (u + v = s)、右上・左下は対角線 (u = v) で分割する
 */
function covers(shape: Shape, u: number, v: number, s: number, tie: Tie): boolean {
  switch (shape) {
    case Shape.Square:
      return true
    case Shape.TopLeft: {
      const d = u + v - s
      return d < 0 || (d === 0 && tie !== Tie.Second)
    }
    case Shape.BottomRight: {
      const d = u + v - s
      return d > 0 || (d === 0 && tie !== Tie.First)
    }
    case Shape.TopRight: {
      const d = u - v
      return d > 0 || (d === 0 && tie !== Tie.Second)
    }
    case Shape.BottomLeft: {
      const d = u - v
      return d < 0 || (d === 0 && tie !== Tie.First)
    }
  }
}

function topAt(stack: StackEntry[], u: number, v: number, s: number, tie: Tie): StackEntry | undefined {
  for (const entry of stack) {
    if (covers(entry.shape, u, v, s, tie)) return entry
  }
  return undefined
}

const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

function packRgba(r: number, g: number, b: number, a: number): number {
  return littleEndian ? ((a << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | a) >>> 0
}

/**
 * 全レイヤーを背面から順に合成した画像を生成する
 * - Canvas 2D のパス描画を使わないことで、タイル間の継ぎ目を生じさせない
 * - アンチエイリアス有効時は 1 ピクセルあたり 4×4 サンプルで合成した後に平均する
 */
export function rasterize(input: RasterInput): RasterOutput {
  const { width, height, layers, tileSize: s, antialias } = input
  const outWidth = width * s
  const outHeight = height * s
  const data = new Uint8ClampedArray(outWidth * outHeight * 4)
  const pixels = new Uint32Array(data.buffer)

  // マスごとに前面から順にタイルを積む。四角に達したらそれより背面は見えない
  const colorCache = new Map<string, [number, number, number]>()
  const stacks = new Map<number, { entries: StackEntry[]; closed: boolean }>()
  for (let li = layers.length - 1; li >= 0; li--) {
    for (const [x, y, color, shape] of layers[li]!) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      const index = y * width + x
      let stack = stacks.get(index)
      if (!stack) {
        stack = { entries: [], closed: false }
        stacks.set(index, stack)
      }
      if (stack.closed) continue
      let rgb = colorCache.get(color)
      if (!rgb) {
        rgb = hexToRgb(color)
        colorCache.set(color, rgb)
      }
      stack.entries.push({ r: rgb[0], g: rgb[1], b: rgb[2], shape })
      if (shape === Shape.Square) stack.closed = true
    }
  }

  const sampleCount = SUPERSAMPLE * SUPERSAMPLE
  for (const [index, { entries }] of stacks) {
    const cx = index % width
    const cy = (index - cx) / width
    const baseX = cx * s
    const baseY = cy * s
    const first = entries[0]!

    if (first.shape === Shape.Square) {
      const packed = packRgba(first.r, first.g, first.b, 255)
      for (let j = 0; j < s; j++) {
        const row = (baseY + j) * outWidth + baseX
        pixels.fill(packed, row, row + s)
      }
      continue
    }

    for (let j = 0; j < s; j++) {
      const row = (baseY + j) * outWidth + baseX
      for (let i = 0; i < s; i++) {
        // 対角線と交わるピクセルのみスーパーサンプリングが必要
        if (antialias && (i === j || i + j === s - 1)) {
          let r = 0
          let g = 0
          let b = 0
          let n = 0
          // サンプル座標は 1/8 ピクセル単位の奇数で表し、対角線上のサンプルは交互に割り振る
          for (let kb = 0; kb < SUPERSAMPLE; kb++) {
            const v = 8 * j + 2 * kb + 1
            for (let ka = 0; ka < SUPERSAMPLE; ka++) {
              const u = 8 * i + 2 * ka + 1
              const entry = topAt(entries, u, v, 8 * s, ka & 1 ? Tie.First : Tie.Second)
              if (entry) {
                r += entry.r
                g += entry.g
                b += entry.b
                n++
              }
            }
          }
          if (n > 0) {
            pixels[row + i] = packRgba(
              Math.round(r / n),
              Math.round(g / n),
              Math.round(b / n),
              Math.round((255 * n) / sampleCount),
            )
          }
        } else {
          // ピクセル中心を 1/2 ピクセル単位で判定する
          const entry = topAt(entries, 2 * i + 1, 2 * j + 1, 2 * s, Tie.Both)
          if (entry) pixels[row + i] = packRgba(entry.r, entry.g, entry.b, 255)
        }
      }
    }
  }

  return { width: outWidth, height: outHeight, data }
}
