<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DEFAULT_TILE_SIZE, TILE_SIZES } from '../model/constants'
import { isInside, lineCells } from '../model/document'
import type { Tool } from '../model/tools'
import type { Cell } from '../model/types'
import { PIPETTE_CURSOR } from '../render/cursors'
import { CANVAS_COLORS, appendShapePath, drawLayerTiles, fillChecker } from '../render/drawTiles'
import { editor } from '../store/editor'
import { isEditableTarget } from '../utils/dom'

const props = defineProps<{
  /** モーダル表示中など、キャンバスへのキーボード操作を受け付けない状態 */
  locked: boolean
}>()

const { doc, revision, selectedColor, selectedShape, activeTool, viewResetToken, activeLayer, activeLayerId } = editor

/** 市松模様の 1 マスの大きさ（CSS px） */
const CHECKER_SIZE = 8
/** 空のマスに設置されるタイルのプレビューの不透明度 */
const PREVIEW_ALPHA = 0.5
/** トラックパッドなどの連続的な入力で 1 段階とみなす移動量 */
const WHEEL_THRESHOLD = 50
/** ピンチ操作（ctrlKey 付きのホイール）で 1 段階とみなす移動量 */
const PINCH_THRESHOLD = 8
/** この時間（ms）以上間隔が空いたホイール操作は、新たな操作の開始とみなす */
const WHEEL_GESTURE_GAP = 150
/** macOS の Chrome / Safari がマウスホイール 1 目盛りにつき返す移動量の単位 */
const MAC_WHEEL_DELTA = 4.000244140625

const container = ref<HTMLDivElement>()
const mainCanvas = ref<HTMLCanvasElement>()
const overlayCanvas = ref<HTMLCanvasElement>()

const viewWidth = ref(0)
const viewHeight = ref(0)
const tileSize = ref(DEFAULT_TILE_SIZE)
/** キャンバス左上の表示位置（CSS px） */
const originX = ref(0)
const originY = ref(0)
const hover = ref<Cell | null>(null)
const spaceHeld = ref(false)
const altHeld = ref(false)

type Gesture =
  | { kind: 'pan'; pointerId: number; startX: number; startY: number; originX: number; originY: number }
  | { kind: 'paint'; pointerId: number; last: Cell; pendingRotate: Cell | null }
  | { kind: 'erase'; pointerId: number; last: Cell }

const gesture = ref<Gesture | null>(null)

/** 非表示のレイヤーは編集できない */
const editable = computed(() => activeLayer.value.visible)

/** 左クリックの操作。Space キー押下中は Pan、Alt キー押下中は Pick に一時的に切り替える */
const leftTool = computed<Tool>(() => {
  if (spaceHeld.value) return 'pan'
  if (altHeld.value) return 'pick'
  return activeTool.value
})

/** マウス位置に対する操作。操作中はその操作とする */
const hoverTool = computed<Tool>(() => {
  switch (gesture.value?.kind) {
    case 'pan':
      return 'pan'
    case 'paint':
      return 'draw'
    case 'erase':
      return 'erase'
    default:
      return leftTool.value
  }
})

const cursor = computed(() => {
  switch (hoverTool.value) {
    case 'pan':
      return gesture.value ? 'grabbing' : 'grab'
    case 'pick':
      return PIPETTE_CURSOR
    default:
      return editable.value ? 'crosshair' : 'not-allowed'
  }
})

const hoverInside = computed(() => hover.value !== null && isInside(doc.value, hover.value.x, hover.value.y))

// ---- 描画 ----

let frame = 0
let mainDirty = true
let overlayDirty = true

function requestRender(main: boolean) {
  if (main) mainDirty = true
  overlayDirty = true
  if (!frame) frame = requestAnimationFrame(render)
}

function render() {
  frame = 0
  if (mainDirty) drawMain()
  if (overlayDirty) drawOverlay()
  mainDirty = false
  overlayDirty = false
}

function prepareCanvas(canvas: HTMLCanvasElement | undefined): { ctx: CanvasRenderingContext2D; dpr: number } | null {
  if (!canvas) return null
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(viewWidth.value * dpr))
  const height = Math.max(1, Math.round(viewHeight.value * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return { ctx, dpr }
}

/** マス座標をデバイスピクセル座標に変換する関数。隣接するマスが同じ整数座標を共有するよう丸める */
function deviceMapper(dpr: number) {
  const size = tileSize.value * dpr
  const ox = Math.round(originX.value * dpr)
  const oy = Math.round(originY.value * dpr)
  return {
    size,
    ox,
    oy,
    x: (cx: number) => ox + Math.round(cx * size),
    y: (cy: number) => oy + Math.round(cy * size),
  }
}

function drawMain() {
  const prepared = prepareCanvas(mainCanvas.value)
  if (!prepared) return
  const { ctx, dpr } = prepared
  const { width: canvasWidth, height: canvasHeight } = ctx.canvas
  ctx.fillStyle = CANVAS_COLORS.outside
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const current = doc.value
  const map = deviceMapper(dpr)
  const left = Math.max(0, map.x(0))
  const top = Math.max(0, map.y(0))
  const right = Math.min(canvasWidth, map.x(current.width))
  const bottom = Math.min(canvasHeight, map.y(current.height))
  if (right <= left || bottom <= top) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(left, top, right - left, bottom - top)
  ctx.clip()

  fillChecker(ctx, CHECKER_SIZE * dpr, map.ox, map.oy, left, top, right - left, bottom - top)

  // 表示範囲内のマスのみ描画する
  const range = {
    x0: Math.max(0, Math.floor((left - map.ox) / map.size) - 1),
    y0: Math.max(0, Math.floor((top - map.oy) / map.size) - 1),
    x1: Math.min(current.width - 1, Math.ceil((right - map.ox) / map.size) + 1),
    y1: Math.min(current.height - 1, Math.ceil((bottom - map.oy) / map.size) + 1),
  }
  for (const layer of current.layers) {
    if (layer.visible) drawLayerTiles(ctx, layer, map.x, map.y, range)
  }

  // ガイドポイント（マス目の交点）
  const dot = Math.max(1, Math.round(dpr * Math.min(2, Math.max(1, tileSize.value / 16))))
  const half = Math.floor(dot / 2)
  const guides = new Path2D()
  for (let gy = range.y0; gy <= range.y1 + 1; gy++) {
    const py = map.y(gy) - half
    for (let gx = range.x0; gx <= range.x1 + 1; gx++) {
      guides.rect(map.x(gx) - half, py, dot, dot)
    }
  }
  ctx.globalAlpha = tileSize.value < 8 ? 0.5 : 1
  ctx.fillStyle = CANVAS_COLORS.guide
  ctx.fill(guides)
  ctx.globalAlpha = 1

  ctx.restore()
}

function drawOverlay() {
  const prepared = prepareCanvas(overlayCanvas.value)
  if (!prepared) return
  const { ctx, dpr } = prepared
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  const current = doc.value
  const map = deviceMapper(dpr)
  const line = Math.max(1, Math.round(dpr))

  // キャンバスの範囲
  ctx.strokeStyle = CANVAS_COLORS.border
  ctx.lineWidth = line
  ctx.strokeRect(
    map.x(0) - line / 2,
    map.y(0) - line / 2,
    map.x(current.width) - map.x(0) + line,
    map.y(current.height) - map.y(0) + line,
  )

  // マウス位置のマス
  const tool = hoverTool.value
  if (hover.value && hoverInside.value && tool !== 'pan' && (tool === 'pick' || editable.value)) {
    const { x, y } = hover.value
    // Draw では空のマスに設置されるタイルを半透明で表示する。編集操作中は表示しない
    if (tool === 'draw' && !gesture.value && !editor.tileAt(x, y)) {
      const path = new Path2D()
      appendShapePath(path, selectedShape.value, map.x(x), map.y(y), map.x(x + 1), map.y(y + 1))
      ctx.globalAlpha = PREVIEW_ALPHA
      ctx.fillStyle = selectedColor.value
      ctx.fill(path)
      ctx.globalAlpha = 1
    }
    ctx.strokeStyle = tool === 'erase' ? CANVAS_COLORS.eraseHover : CANVAS_COLORS.hover
    ctx.strokeRect(map.x(x) + line / 2, map.y(y) + line / 2, map.x(x + 1) - map.x(x) - line, map.y(y + 1) - map.y(y) - line)
  }
}

watch([doc, revision, tileSize, originX, originY, viewWidth, viewHeight], () => requestRender(true))
watch([hover, hoverTool, gesture, editable, activeLayerId, selectedColor, selectedShape], () => requestRender(false))

// ---- 表示位置 ----

function centerView() {
  originX.value = Math.round((viewWidth.value - doc.value.width * tileSize.value) / 2)
  originY.value = Math.round((viewHeight.value - doc.value.height * tileSize.value) / 2)
}

function resetView() {
  tileSize.value = DEFAULT_TILE_SIZE
  centerView()
}

watch(viewResetToken, resetView)
// リサイズでキャンバスが表示範囲外に出ないよう、サイズが変わったら中央に合わせる
watch(
  () => [doc.value.width, doc.value.height],
  ([width, height], [oldWidth, oldHeight]) => {
    if (width !== oldWidth || height !== oldHeight) centerView()
  },
)

function zoom(direction: 1 | -1, anchorX: number, anchorY: number) {
  const index = TILE_SIZES.indexOf(tileSize.value)
  const nextIndex = Math.min(TILE_SIZES.length - 1, Math.max(0, index + direction))
  if (nextIndex === index) return
  const nextSize = TILE_SIZES[nextIndex]!
  // マウス位置のマス座標を保ったまま拡縮する
  const cellX = (anchorX - originX.value) / tileSize.value
  const cellY = (anchorY - originY.value) / tileSize.value
  tileSize.value = nextSize
  originX.value = anchorX - cellX * nextSize
  originY.value = anchorY - cellY * nextSize
}

let wheelAccumulator = 0
let lastWheelTime = -Infinity

/**
 * マウスホイールのように 1 目盛りごとにイベントが発生する入力か
 * - Firefox は deltaY より先に deltaMode を参照した場合に行単位の値を返すため、先に deltaMode を参照する
 */
function isNotchedWheel(event: WheelEvent): boolean {
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return true
  const notches = Math.abs(event.deltaY) / MAC_WHEEL_DELTA
  return notches >= 1 && Number.isInteger(notches)
}

/** マウスホイールは 1 目盛りごとに、トラックパッドなどは操作の開始時と移動量が一定に達するごとに 1 段階拡縮する */
function onWheel(event: WheelEvent) {
  event.preventDefault()
  const notched = isNotchedWheel(event)
  const delta = event.deltaY
  const gestureStart = event.timeStamp - lastWheelTime >= WHEEL_GESTURE_GAP
  lastWheelTime = event.timeStamp
  // 主に横方向の操作は拡縮に使わない
  if (delta === 0 || Math.abs(event.deltaX) > Math.abs(delta)) return
  if (Math.sign(delta) !== Math.sign(wheelAccumulator)) wheelAccumulator = 0
  wheelAccumulator += delta
  const threshold = event.ctrlKey ? PINCH_THRESHOLD : WHEEL_THRESHOLD
  if (!notched && !gestureStart && Math.abs(wheelAccumulator) < threshold) return
  wheelAccumulator = 0
  const point = localPoint(event)
  zoom(delta < 0 ? 1 : -1, point.x, point.y)
}

// ---- ポインター操作 ----

function localPoint(event: MouseEvent): { x: number; y: number } {
  const rect = container.value!.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function cellAt(event: MouseEvent): Cell {
  const point = localPoint(event)
  return {
    x: Math.floor((point.x - originX.value) / tileSize.value),
    y: Math.floor((point.y - originY.value) / tileSize.value),
  }
}

function sameCell(a: Cell | null, b: Cell | null): boolean {
  return a !== null && b !== null && a.x === b.x && a.y === b.y
}

function onPointerDown(event: PointerEvent) {
  if (gesture.value || !container.value) return
  altHeld.value = event.altKey
  // 右クリックはツールによらず Erase とする
  const tool = event.button === 0 ? leftTool.value : event.button === 2 ? 'erase' : null
  if (!tool) return
  const cell = cellAt(event)
  if (tool === 'pick') {
    // Pick ツールで拾った場合は Draw に戻る。Alt キーによる一時的な切り替えではツールを変えない
    if (editor.pickAt(cell.x, cell.y) && activeTool.value === 'pick') editor.selectTool('draw')
    event.preventDefault()
    return
  }
  if (tool === 'pan') {
    gesture.value = {
      kind: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: originX.value,
      originY: originY.value,
    }
  } else if (tool === 'draw') {
    if (!editor.beginStroke()) return
    let pendingRotate: Cell | null = null
    const tile = editor.tileAt(cell.x, cell.y)
    if (tile && tile.color === selectedColor.value) {
      // 同じ色のタイルは、移動せずに離した時点で回転させる
      pendingRotate = cell
    } else {
      editor.paintAt(cell.x, cell.y)
    }
    gesture.value = { kind: 'paint', pointerId: event.pointerId, last: cell, pendingRotate }
  } else {
    if (!editor.beginStroke()) return
    editor.eraseAt(cell.x, cell.y)
    gesture.value = { kind: 'erase', pointerId: event.pointerId, last: cell }
  }
  container.value.setPointerCapture(event.pointerId)
  event.preventDefault()
}

function onPointerMove(event: PointerEvent) {
  const current = gesture.value
  if (current?.kind === 'pan') {
    if (current.pointerId !== event.pointerId) return
    originX.value = current.originX + event.clientX - current.startX
    originY.value = current.originY + event.clientY - current.startY
    return
  }
  altHeld.value = event.altKey
  const cell = cellAt(event)
  if (!sameCell(hover.value, cell)) hover.value = cell
  if (!current || current.pointerId !== event.pointerId || sameCell(current.last, cell)) return

  // 素早く動かしても途切れないよう、前回のマスから直線上のマスをすべて処理する
  for (const step of lineCells(current.last, cell)) {
    if (current.kind === 'paint') {
      editor.paintAt(step.x, step.y)
    } else {
      editor.eraseAt(step.x, step.y)
    }
  }
  if (current.kind === 'paint') current.pendingRotate = null
  current.last = cell
}

function finishGesture(event: PointerEvent, cancelled: boolean) {
  const current = gesture.value
  if (!current || current.pointerId !== event.pointerId) return
  gesture.value = null
  if (container.value?.hasPointerCapture(event.pointerId)) {
    container.value.releasePointerCapture(event.pointerId)
  }
  if (current.kind === 'pan') return
  if (!cancelled && current.kind === 'paint' && current.pendingRotate) {
    editor.rotateAt(current.pendingRotate.x, current.pendingRotate.y)
  }
  editor.endStroke()
}

function onPointerUp(event: PointerEvent) {
  finishGesture(event, false)
}

function onPointerCancel(event: PointerEvent) {
  finishGesture(event, true)
}

function onPointerLeave() {
  if (!gesture.value) hover.value = null
}

// ---- キーボード ----

function onKeyDown(event: KeyboardEvent) {
  if (props.locked || isEditableTarget(event.target)) return
  if (event.key === 'Alt') {
    altHeld.value = true
    return
  }
  if (event.code !== 'Space') return
  // ページのスクロールやフォーカス中のボタンの押下を防ぐ
  event.preventDefault()
  spaceHeld.value = true
}

function onKeyUp(event: KeyboardEvent) {
  if (event.key === 'Alt') {
    altHeld.value = false
    return
  }
  if (event.code !== 'Space') return
  if (!isEditableTarget(event.target)) event.preventDefault()
  spaceHeld.value = false
}

function onBlur() {
  spaceHeld.value = false
  altHeld.value = false
}

watch(
  () => props.locked,
  (locked) => {
    if (locked) {
      spaceHeld.value = false
      altHeld.value = false
      hover.value = null
    }
  },
)

// ---- ライフサイクル ----

let resizeObserver: ResizeObserver | null = null
let centered = false

function onDevicePixelRatioChange() {
  requestRender(true)
}

let dprQuery: MediaQueryList | null = null

function watchDevicePixelRatio() {
  dprQuery?.removeEventListener('change', watchDevicePixelRatio)
  dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
  dprQuery.addEventListener('change', watchDevicePixelRatio)
  onDevicePixelRatioChange()
}

onMounted(() => {
  const el = container.value!
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return
    viewWidth.value = entry.contentRect.width
    viewHeight.value = entry.contentRect.height
    if (!centered && viewWidth.value > 0 && viewHeight.value > 0) {
      centered = true
      resetView()
    }
  })
  resizeObserver.observe(el)
  el.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  watchDevicePixelRatio()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  container.value?.removeEventListener('wheel', onWheel)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
  dprQuery?.removeEventListener('change', watchDevicePixelRatio)
  if (frame) cancelAnimationFrame(frame)
})
</script>

<template>
  <div
    ref="container"
    class="editor-canvas"
    :style="{ cursor }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @pointerleave="onPointerLeave"
    @contextmenu.prevent
  >
    <canvas ref="mainCanvas" class="editor-canvas__layer" />
    <canvas ref="overlayCanvas" class="editor-canvas__layer" />
    <p class="status" aria-live="off">
      <span>{{ doc.width }} × {{ doc.height }}</span>
      <span>{{ tileSize }}px</span>
      <span v-if="hover && hoverInside">{{ hover.x }}, {{ hover.y }}</span>
    </p>
  </div>
</template>

<style scoped>
.editor-canvas {
  position: relative;
  overflow: hidden;
  background: #141518;
  touch-action: none;
  user-select: none;
}

.editor-canvas__layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.status {
  position: absolute;
  bottom: 8px;
  left: 8px;
  display: flex;
  gap: 12px;
  padding: 4px 10px;
  border-radius: var(--radius);
  background: rgb(20 21 24 / 80%);
  color: var(--color-text-dim);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
</style>
