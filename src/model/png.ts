/**
 * RGBA 8bit の PNG エンコーダー
 * - Canvas を経由すると半透明ピクセルの色が乗算済みアルファの丸めで劣化するため、画素値をそのまま書き出す
 * - 圧縮には CompressionStream（zlib 形式）を使う
 */

const SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/** IDAT チャンク 1 つあたりの最大バイト数 */
const IDAT_CHUNK_SIZE = 1 << 23
/** 圧縮ストリームに一度に渡す行数 */
const ROWS_PER_WRITE = 64

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(chunks: Uint8Array[]): number {
  let crc = 0xffffffff
  for (const bytes of chunks) {
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const typeBytes = new Uint8Array([...type].map((c) => c.charCodeAt(0)))
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(typeBytes, 4)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32([typeBytes, data]))
  return out
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

/** 行ごとに None / Sub / Up / Paeth のうち差分の絶対値の和が最小のフィルターを選ぶ */
function filterRow(
  data: Uint8Array | Uint8ClampedArray,
  rowStart: number,
  prevStart: number,
  stride: number,
  out: Uint8Array,
  outStart: number,
  scratch: Uint8Array,
): void {
  let bestScore = Infinity
  for (let type = 0; type <= 4; type++) {
    if (type === 3) continue
    let score = 0
    for (let i = 0; i < stride; i++) {
      const x = data[rowStart + i]!
      const a = i >= 4 ? data[rowStart + i - 4]! : 0
      const b = prevStart >= 0 ? data[prevStart + i]! : 0
      const c = i >= 4 && prevStart >= 0 ? data[prevStart + i - 4]! : 0
      const predicted = type === 0 ? 0 : type === 1 ? a : type === 2 ? b : paeth(a, b, c)
      const value = (x - predicted) & 0xff
      scratch[i] = value
      score += value < 128 ? value : 256 - value
      if (score >= bestScore) break
    }
    if (score < bestScore) {
      bestScore = score
      out[outStart] = type
      out.set(scratch.subarray(0, stride), outStart + 1)
    }
  }
}

export async function encodePng(
  width: number,
  height: number,
  rgba: Uint8Array | Uint8ClampedArray,
): Promise<Uint8Array<ArrayBuffer>> {
  if (rgba.length !== width * height * 4) throw new RangeError('Pixel data does not match the image size.')

  const header = new Uint8Array(13)
  const headerView = new DataView(header.buffer)
  headerView.setUint32(0, width)
  headerView.setUint32(4, height)
  header[8] = 8 // ビット深度
  header[9] = 6 // RGBA
  header[10] = 0 // 圧縮方式
  header[11] = 0 // フィルター方式
  header[12] = 0 // インターレースなし

  const stride = width * 4
  const scratch = new Uint8Array(stride)
  let nextRow = 0
  // 巨大な画像でもフィルター済みデータを一度に保持しないよう、読み出しに応じて生成する
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    pull(controller) {
      if (nextRow >= height) {
        controller.close()
        return
      }
      const rows = Math.min(ROWS_PER_WRITE, height - nextRow)
      const block = new Uint8Array(rows * (stride + 1))
      for (let r = 0; r < rows; r++) {
        const y = nextRow + r
        filterRow(rgba, y * stride, y > 0 ? (y - 1) * stride : -1, stride, block, r * (stride + 1), scratch)
      }
      nextRow += rows
      controller.enqueue(block)
    },
  })
  const compressed = new Uint8Array(
    await new Response(source.pipeThrough(new CompressionStream('deflate'))).arrayBuffer(),
  )

  const parts: Uint8Array<ArrayBuffer>[] = [SIGNATURE, chunk('IHDR', header)]
  for (let offset = 0; offset < compressed.length; offset += IDAT_CHUNK_SIZE) {
    parts.push(chunk('IDAT', compressed.subarray(offset, offset + IDAT_CHUNK_SIZE)))
  }
  parts.push(chunk('IEND', new Uint8Array(0)))

  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const png = new Uint8Array(total)
  let position = 0
  for (const part of parts) {
    png.set(part, position)
    position += part.length
  }
  return png
}
