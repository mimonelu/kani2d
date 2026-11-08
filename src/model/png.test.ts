import { describe, expect, it } from 'vitest'
import { encodePng } from './png'

interface Chunk {
  type: string
  data: Uint8Array<ArrayBuffer>
}

function readChunks(png: Uint8Array<ArrayBuffer>): Chunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const chunks: Chunk[] = []
  let offset = 8
  while (offset < png.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8))
    chunks.push({ type, data: png.subarray(offset + 8, offset + 8 + length) })
    offset += 12 + length
  }
  return chunks
}

async function inflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

function unfilter(raw: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 4
  const out = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)]!
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i]!
      const a = i >= 4 ? out[y * stride + i - 4]! : 0
      const b = y > 0 ? out[(y - 1) * stride + i]! : 0
      const c = i >= 4 && y > 0 ? out[(y - 1) * stride + i - 4]! : 0
      const predicted = [0, a, b, (a + b) >> 1, paeth(a, b, c)][type]!
      out[y * stride + i] = (x + predicted) & 0xff
    }
  }
  return out
}

describe('encodePng', () => {
  it('encodes RGBA pixels losslessly', async () => {
    const width = 7
    const height = 5
    const pixels = new Uint8Array(width * height * 4)
    for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 37 + (i >> 3) * 11) & 0xff
    // 半透明ピクセルの色がそのまま保たれること
    pixels.set([255, 64, 0, 16], 0)

    const png = await encodePng(width, height, pixels)
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const chunks = readChunks(png)
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND'])
    const ihdr = new DataView(chunks[0]!.data.buffer, chunks[0]!.data.byteOffset)
    expect(ihdr.getUint32(0)).toBe(width)
    expect(ihdr.getUint32(4)).toBe(height)
    expect([...chunks[0]!.data.subarray(8)]).toEqual([8, 6, 0, 0, 0])

    const raw = await inflate(chunks[1]!.data)
    expect(raw.length).toBe((width * 4 + 1) * height)
    expect(unfilter(raw, width, height)).toEqual(pixels)
  })

  it('rejects mismatched sizes', async () => {
    await expect(encodePng(2, 2, new Uint8Array(4))).rejects.toThrow(RangeError)
  })
})
