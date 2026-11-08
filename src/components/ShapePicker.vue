<script setup lang="ts">
import { SHAPE_ORDER, Shape } from '../model/types'
import { editor } from '../store/editor'

const { selectedShape } = editor

/** points は 16×16 の枠内の多角形 */
const SHAPE_ICONS: Record<Shape, { label: string; points: string }> = {
  [Shape.Square]: { label: 'Square', points: '2,2 14,2 14,14 2,14' },
  [Shape.TopLeft]: { label: 'Top-left triangle', points: '2,2 14,2 2,14' },
  [Shape.TopRight]: { label: 'Top-right triangle', points: '2,2 14,2 14,14' },
  [Shape.BottomRight]: { label: 'Bottom-right triangle', points: '14,2 14,14 2,14' },
  [Shape.BottomLeft]: { label: 'Bottom-left triangle', points: '2,2 14,14 2,14' },
}

/** ローテーションと同じ順に並べる */
const SHAPES = SHAPE_ORDER.map((shape) => ({ shape, ...SHAPE_ICONS[shape] }))
</script>

<template>
  <section class="shapes" aria-labelledby="shapes-title">
    <h2 id="shapes-title" class="shapes__title">Shapes</h2>
    <div class="shapes__list" role="listbox" aria-label="Tile shape">
      <button
        v-for="item in SHAPES"
        :key="item.shape"
        type="button"
        class="shape"
        :class="{ 'shape--selected': item.shape === selectedShape }"
        :title="item.label"
        role="option"
        :aria-selected="item.shape === selectedShape"
        :aria-label="item.label"
        @click="editor.selectShape(item.shape)"
      >
        <svg class="shape__icon" viewBox="0 0 16 16" aria-hidden="true">
          <polygon :points="item.points" />
        </svg>
      </button>
    </div>
  </section>
</template>

<style scoped>
.shapes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--color-border);
}

.shapes__title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-dim);
}

.shapes__list {
  display: flex;
  gap: 6px;
}

.shape {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-panel-raised);
  color: var(--color-text-dim);
  cursor: pointer;
}

.shape:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.shape--selected,
.shape--selected:hover {
  border-color: var(--color-accent);
  background: var(--color-active);
  color: var(--color-text);
}

.shape__icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
</style>
