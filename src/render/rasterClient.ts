import type { RasterInput, RasterOutput } from '../model/raster'
import type { RasterRequest, RasterResponse } from '../workers/raster.worker'

export class RasterCancelledError extends Error {
  constructor() {
    super('Rendering was cancelled.')
    this.name = 'RasterCancelledError'
  }
}

interface Pending {
  id: number
  resolve: (response: { width: number; height: number; buffer: ArrayBuffer }) => void
  reject: (error: Error) => void
}

/** 出力画像のラスタライズを Web Worker で行う。新しい要求は実行中の要求を中断する */
export class RasterClient {
  private worker: Worker | null = null
  private pending: Pending | null = null
  private sequence = 0

  /** RGBA の画素データを生成する */
  async render(input: RasterInput): Promise<RasterOutput> {
    const { width, height, buffer } = await this.request(input, 'pixels')
    return { width, height, data: new Uint8ClampedArray(buffer) }
  }

  /** PNG にエンコードしたデータを生成する */
  async renderPng(input: RasterInput): Promise<Blob> {
    const { buffer } = await this.request(input, 'png')
    return new Blob([buffer], { type: 'image/png' })
  }

  private request(
    input: RasterInput,
    format: RasterRequest['format'],
  ): Promise<{ width: number; height: number; buffer: ArrayBuffer }> {
    if (this.pending) {
      // 実行中の処理は中断できないため、Worker ごと破棄する
      this.pending.reject(new RasterCancelledError())
      this.pending = null
      this.terminate()
    }
    const worker = this.ensureWorker()
    this.sequence += 1
    const id = this.sequence
    return new Promise((resolve, reject) => {
      this.pending = { id, resolve, reject }
      const request: RasterRequest = { id, input, format }
      worker.postMessage(request)
    })
  }

  dispose(): void {
    if (this.pending) {
      this.pending.reject(new RasterCancelledError())
      this.pending = null
    }
    this.terminate()
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker(new URL('../workers/raster.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<RasterResponse>) => {
      const pending = this.pending
      const response = event.data
      if (!pending || pending.id !== response.id) return
      this.pending = null
      if (response.ok) {
        pending.resolve({ width: response.width, height: response.height, buffer: response.buffer })
      } else {
        pending.reject(new Error(response.error))
      }
    }
    worker.onerror = (event) => {
      const pending = this.pending
      this.pending = null
      this.terminate()
      pending?.reject(new Error(event.message || 'Rendering failed.'))
    }
    this.worker = worker
    return worker
  }

  private terminate(): void {
    this.worker?.terminate()
    this.worker = null
  }
}
