<script setup lang="ts">
import { BrushCleaning, Copy, Eye, EyeOff, GripVertical, Plus, Trash } from '@lucide/vue'
import { computed, ref } from 'vue'
import type { Layer } from '../model/types'
import { editor } from '../store/editor'
import LayerThumbnail from './LayerThumbnail.vue'

const { doc, activeLayerId, revision } = editor

/** 前面のレイヤーほど上に表示する */
const displayLayers = computed(() => [...doc.value.layers].reverse())

const list = ref<HTMLOListElement>()

interface DragState {
  layerId: string
  pointerId: number
  startY: number
  offsetY: number
  /** 移動先のドキュメント上のインデックス */
  targetIndex: number
  /** リスト上端からの挿入位置 */
  indicatorY: number
}

const drag = ref<DragState | null>(null)

function isBackground(layer: Layer): boolean {
  return doc.value.layers[0]?.id === layer.id
}

function itemElements(): HTMLElement[] {
  return list.value ? [...list.value.querySelectorAll<HTMLElement>(':scope > .layer')] : []
}

function startDrag(event: PointerEvent, layer: Layer) {
  if (event.button !== 0 || drag.value) return
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  const index = doc.value.layers.findIndex((l) => l.id === layer.id)
  drag.value = {
    layerId: layer.id,
    pointerId: event.pointerId,
    startY: event.clientY,
    offsetY: 0,
    targetIndex: index,
    indicatorY: -1,
  }
  event.preventDefault()
}

function moveDrag(event: PointerEvent) {
  const state = drag.value
  if (!state || state.pointerId !== event.pointerId || !list.value) return
  state.offsetY = event.clientY - state.startY

  // ドラッグ中のアイテムを除き、上から順に並べたアイテム
  const items = itemElements().filter((el) => el.dataset.id !== state.layerId)
  const backgroundId = doc.value.layers[0]!.id
  const movable = items.filter((el) => el.dataset.id !== backgroundId)
  const above = movable.filter((el) => {
    const rect = el.getBoundingClientRect()
    return rect.top + rect.height / 2 < event.clientY
  }).length
  state.targetIndex = doc.value.layers.length - 1 - above

  const listRect = list.value.getBoundingClientRect()
  const reference = above === 0 ? items[0] : items[above - 1]
  if (reference) {
    const rect = reference.getBoundingClientRect()
    const edge = above === 0 ? rect.top : rect.bottom
    state.indicatorY = edge - listRect.top + list.value.scrollTop
  }
}

function endDrag(event: PointerEvent) {
  const state = drag.value
  if (!state || state.pointerId !== event.pointerId) return
  drag.value = null
  const from = doc.value.layers.findIndex((l) => l.id === state.layerId)
  if (from > 0 && state.targetIndex !== from) editor.moveLayer(from, state.targetIndex)
}

function cancelDrag(event: PointerEvent) {
  if (drag.value?.pointerId === event.pointerId) drag.value = null
}
</script>

<template>
  <section class="layers" aria-labelledby="layers-title">
    <header class="layers__header">
      <h2 id="layers-title" class="sidebar-title">Layers</h2>
      <button type="button" class="icon-button" title="Add layer" aria-label="Add layer" @click="editor.addLayer()">
        <Plus :size="16" />
      </button>
    </header>
    <ol ref="list" class="layers__list">
      <li
        v-for="layer in displayLayers"
        :key="layer.id"
        class="layer"
        :class="{
          'layer--active': layer.id === activeLayerId,
          'layer--dragging': drag?.layerId === layer.id,
          'layer--hidden': !layer.visible,
        }"
        :style="drag?.layerId === layer.id ? { transform: `translateY(${drag.offsetY}px)` } : undefined"
        :data-id="layer.id"
        :aria-current="layer.id === activeLayerId ? 'true' : undefined"
        @click="editor.setActiveLayer(layer.id)"
      >
        <span
          v-if="!isBackground(layer)"
          class="layer__handle"
          title="Drag to reorder"
          @pointerdown.stop="startDrag($event, layer)"
          @pointermove="moveDrag"
          @pointerup="endDrag"
          @pointercancel="cancelDrag"
        >
          <GripVertical :size="16" />
        </span>
        <span v-else class="layer__handle layer__handle--placeholder" />
        <LayerThumbnail
          class="layer__thumbnail"
          :layer="layer"
          :width="doc.width"
          :height="doc.height"
          :active="layer.id === activeLayerId"
          :revision="revision"
        />
        <span class="layer__name" :title="layer.name">{{ layer.name }}</span>
        <span class="layer__actions">
          <button
            type="button"
            class="icon-button"
            :title="layer.visible ? 'Hide layer' : 'Show layer'"
            :aria-label="layer.visible ? 'Hide layer' : 'Show layer'"
            @click.stop="editor.toggleLayerVisibility(layer.id)"
          >
            <Eye v-if="layer.visible" :size="15" />
            <EyeOff v-else :size="15" />
          </button>
          <button
            type="button"
            class="icon-button"
            title="Duplicate layer"
            aria-label="Duplicate layer"
            @click.stop="editor.duplicateLayer(layer.id)"
          >
            <Copy :size="15" />
          </button>
          <button
            v-if="!isBackground(layer)"
            type="button"
            class="icon-button"
            title="Delete layer"
            aria-label="Delete layer"
            @click.stop="editor.deleteLayer(layer.id)"
          >
            <Trash :size="15" />
          </button>
          <button
            v-else
            type="button"
            class="icon-button"
            title="Clear layer"
            aria-label="Clear layer"
            :disabled="layer.tiles.size === 0"
            @click.stop="editor.clearLayer(layer.id)"
          >
            <BrushCleaning :size="15" />
          </button>
        </span>
      </li>
      <li
        v-if="drag && drag.indicatorY >= 0"
        class="layers__indicator"
        :style="{ top: `${drag.indicatorY}px` }"
        aria-hidden="true"
      />
    </ol>
  </section>
</template>

<style scoped>
.layers {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.layers__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 4px 12px;
}

.layers__list {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0 8px 8px;
  overflow-y: auto;
  list-style: none;
}

.layer {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 4px;
  border-radius: var(--radius);
  cursor: pointer;
  user-select: none;
}

.layer:hover {
  background: var(--color-hover);
}

.layer--active,
.layer--active:hover {
  background: var(--color-active);
}

.layer--dragging {
  position: relative;
  z-index: 1;
  opacity: 0.85;
  box-shadow: 0 4px 16px rgb(0 0 0 / 45%);
}

.layer__handle {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 32px;
  color: var(--color-text-dim);
  cursor: grab;
  touch-action: none;
}

.layer--dragging .layer__handle {
  cursor: grabbing;
}

.layer__handle--placeholder {
  cursor: default;
}

.layer--hidden .layer__thumbnail,
.layer--hidden .layer__name {
  opacity: 0.4;
}

.layer__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer__actions {
  display: flex;
  flex: none;
  gap: 2px;
}

.layers__indicator {
  position: absolute;
  right: 8px;
  left: 8px;
  height: 2px;
  margin-top: -1px;
  border-radius: 1px;
  background: var(--color-accent);
  pointer-events: none;
}
</style>
