<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Layer } from '../model/types'
import { CANVAS_COLORS, drawLayerTiles, fillChecker } from '../render/drawTiles'

const props = defineProps<{
  layer: Layer
  width: number
  height: number
  /** ストローク中はレイヤーの参照が変わらないため、アクティブなレイヤーのみ revision で再描画する */
  active: boolean
  revision: number
}>()

const SIZE = 40

const canvas = ref<HTMLCanvasElement>()
let frame = 0

function draw() {
  frame = 0
  const el = canvas.value
  if (!el) return
  const dpr = window.devicePixelRatio || 1
  const size = Math.round(SIZE * dpr)
  if (el.width !== size || el.height !== size) {
    el.width = size
    el.height = size
  }
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = CANVAS_COLORS.outside
  ctx.fillRect(0, 0, size, size)
  const scale = Math.min(size / props.width, size / props.height)
  const w = props.width * scale
  const h = props.height * scale
  const ox = (size - w) / 2
  const oy = (size - h) / 2
  fillChecker(ctx, 4 * dpr, ox, oy, ox, oy, w, h)
  drawLayerTiles(
    ctx,
    props.layer,
    (x) => ox + x * scale,
    (y) => oy + y * scale,
  )
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(draw)
}

watch(
  () => [props.layer, props.width, props.height, props.active ? props.revision : -1],
  schedule,
)

onMounted(draw)

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
})
</script>

<template>
  <canvas ref="canvas" class="thumbnail" :style="{ width: `${SIZE}px`, height: `${SIZE}px` }" aria-hidden="true" />
</template>

<style scoped>
.thumbnail {
  display: block;
  flex: none;
  box-sizing: content-box;
  border: 1px solid var(--color-border-strong);
  border-radius: 4px;
}
</style>
