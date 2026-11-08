import { encodePng } from '../model/png'
import { rasterize, type RasterInput } from '../model/raster'

export interface RasterRequest {
  id: number
  input: RasterInput
  /** pixels: RGBA の画素データを返す。png: PNG にエンコードしたデータを返す */
  format: 'pixels' | 'png'
}

export type RasterResponse =
  | { id: number; ok: true; width: number; height: number; buffer: ArrayBuffer }
  | { id: number; ok: false; error: string }

self.onmessage = async (event: MessageEvent<RasterRequest>) => {
  const { id, input, format } = event.data
  try {
    const output = rasterize(input)
    const buffer = format === 'png' ? (await encodePng(output.width, output.height, output.data)).buffer : output.data.buffer
    const response: RasterResponse = { id, ok: true, width: output.width, height: output.height, buffer }
    self.postMessage(response, { transfer: [buffer] })
  } catch (error) {
    const message = error instanceof RangeError ? 'Not enough memory to render the image.' : error instanceof Error ? error.message : String(error)
    const response: RasterResponse = { id, ok: false, error: message }
    self.postMessage(response)
  }
}
