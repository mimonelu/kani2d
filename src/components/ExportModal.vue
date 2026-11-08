<script lang="ts">
import { DEFAULT_EXPORT_TILE_SIZE } from '../model/constants'

// ポップアップを閉じても設定を保持する
const lastSettings = {
  tileSize: DEFAULT_EXPORT_TILE_SIZE as string | number,
  antialias: true,
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MAX_EXPORT_DIMENSION } from '../model/constants'
import { serializeTiles } from '../model/fileFormat'
import type { RasterInput, RasterOutput } from '../model/raster'
import { RasterCancelledError, RasterClient } from '../render/rasterClient'
import { editor } from '../store/editor'
import { downloadBlob } from '../utils/download'
import BaseModal from './BaseModal.vue'

const emit = defineEmits<{
  close: []
}>()

/** プレビューで実寸描画する最大ピクセル数。超える場合は縮小して描画する */
const PREVIEW_MAX_PIXELS = 2048 * 2048
const PREVIEW_DELAY = 150

const { doc, docName } = editor
// ポップアップ表示中は編集できないため、開いた時点の内容を出力する
const source = doc.value
const layers = source.layers.map((layer) => serializeTiles(layer.tiles))

const tileSizeInput = ref<string | number>(lastSettings.tileSize)
const antialias = ref(lastSettings.antialias)

const maxTileSize = Math.floor(MAX_EXPORT_DIMENSION / Math.max(source.width, source.height))

const tileSize = computed(() => {
  const text = String(tileSizeInput.value).trim()
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) && value >= 1 ? value : null
})

const error = computed(() => {
  if (maxTileSize < 1) {
    return `The canvas is too large to export. Images are limited to ${MAX_EXPORT_DIMENSION}px per side.`
  }
  if (tileSize.value === null) return 'Enter a whole number of 1 or more.'
  if (tileSize.value > maxTileSize) {
    return `The image would exceed ${MAX_EXPORT_DIMENSION}px per side. The maximum tile size is ${maxTileSize}px.`
  }
  return null
})

const outputSize = computed(() =>
  tileSize.value === null ? null : { width: source.width * tileSize.value, height: source.height * tileSize.value },
)

const previewBox = ref<HTMLElement>()
const previewCanvas = ref<HTMLCanvasElement>()
const previewScaled = ref(false)
const previewError = ref<string | null>(null)
const rendering = ref(false)
const exporting = ref(false)

const client = new RasterClient()
let previewTimer: ReturnType<typeof setTimeout> | null = null
/** 古いプレビュー要求の結果を無視するための番号 */
let previewToken = 0

function createInput(size: number): RasterInput {
  return { width: source.width, height: source.height, layers, tileSize: size, antialias: antialias.value }
}

/** 実寸（デバイスピクセル等倍）で表示し、枠に収まらない場合は縮小する */
function fitPreview() {
  const canvas = previewCanvas.value
  const box = previewBox.value
  if (!canvas || !box || canvas.width === 0 || canvas.height === 0) return
  const style = getComputedStyle(box)
  const boxWidth = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  const boxHeight = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
  const scale = Math.min(1 / (window.devicePixelRatio || 1), boxWidth / canvas.width, boxHeight / canvas.height)
  canvas.style.width = `${canvas.width * scale}px`
  canvas.style.height = `${canvas.height * scale}px`
}

function drawPreview(output: RasterOutput) {
  const canvas = previewCanvas.value
  if (!canvas) return
  canvas.width = output.width
  canvas.height = output.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.putImageData(new ImageData(output.data, output.width, output.height), 0, 0)
  fitPreview()
}

async function renderPreview() {
  previewTimer = null
  const token = ++previewToken
  if (error.value !== null || tileSize.value === null) {
    rendering.value = false
    return
  }
  const size = tileSize.value
  const pixels = source.width * source.height * size * size
  const previewSize =
    pixels <= PREVIEW_MAX_PIXELS
      ? size
      : Math.max(1, Math.floor(Math.sqrt(PREVIEW_MAX_PIXELS / (source.width * source.height))))
  rendering.value = true
  previewError.value = null
  try {
    const output = await client.render(createInput(previewSize))
    if (token !== previewToken) return
    previewScaled.value = previewSize !== size
    drawPreview(output)
  } catch (e) {
    if (e instanceof RasterCancelledError || token !== previewToken) return
    previewError.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (token === previewToken) rendering.value = false
  }
}

watch(
  [tileSizeInput, antialias],
  () => {
    lastSettings.tileSize = tileSizeInput.value
    lastSettings.antialias = antialias.value
    if (previewTimer !== null) clearTimeout(previewTimer)
    previewTimer = setTimeout(renderPreview, PREVIEW_DELAY)
  },
  { immediate: true },
)

async function exportImage() {
  if (error.value !== null || tileSize.value === null || exporting.value) return
  // 実行中・待機中のプレビューは中断する
  if (previewTimer !== null) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
  previewToken++
  rendering.value = false
  exporting.value = true
  previewError.value = null
  try {
    const blob = await client.renderPng(createInput(tileSize.value))
    downloadBlob(blob, `${docName.value}.png`)
    emit('close')
  } catch (e) {
    if (e instanceof RasterCancelledError) return
    previewError.value = e instanceof Error ? e.message : String(e)
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  window.addEventListener('resize', fitPreview)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitPreview)
  if (previewTimer !== null) clearTimeout(previewTimer)
  previewToken++
  client.dispose()
})
</script>

<template>
  <BaseModal title="Export PNG" wide @close="emit('close')">
    <div ref="previewBox" class="preview checker-bg">
      <canvas v-show="error === null" ref="previewCanvas" class="preview__canvas" />
      <p v-if="error !== null" class="preview__message">Preview is unavailable.</p>
      <p v-else-if="rendering" class="preview__badge">Rendering…</p>
    </div>
    <form id="export-form" class="settings" @submit.prevent="exportImage">
      <label class="field">
        <span class="field__label">Tile size (px)</span>
        <input
          v-model="tileSizeInput"
          class="text-input tile-size"
          type="number"
          min="1"
          step="1"
          :max="maxTileSize >= 1 ? maxTileSize : undefined"
          :disabled="exporting"
          required
          autofocus
          :aria-invalid="error !== null"
        />
      </label>
      <label class="checkbox">
        <input v-model="antialias" type="checkbox" :disabled="exporting" />
        <span>Anti-aliasing</span>
      </label>
      <p class="info">
        <template v-if="outputSize">Output: {{ outputSize.width }} × {{ outputSize.height }} px</template>
        <template v-if="previewScaled && error === null"> (preview is scaled down)</template>
      </p>
    </form>
    <p v-if="error !== null" class="error-text">{{ error }}</p>
    <p v-if="previewError !== null" class="error-text">{{ previewError }}</p>
    <template #footer>
      <button type="button" class="button" @click="emit('close')">Cancel</button>
      <button
        type="submit"
        form="export-form"
        class="button button--primary"
        :disabled="error !== null || exporting"
      >
        {{ exporting ? 'Exporting…' : 'Export' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  height: min(420px, 50vh);
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.preview__canvas {
  display: block;
}

.preview__message {
  color: var(--color-text-dim);
}

.preview__badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgb(0 0 0 / 60%);
  color: var(--color-text-dim);
  font-size: 12px;
}

.settings {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
}

.tile-size {
  width: 120px;
}

.checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  cursor: pointer;
}

.info {
  margin-left: auto;
  padding-bottom: 7px;
  color: var(--color-text-dim);
}
</style>
