<script setup lang="ts">
import { computed } from 'vue'
import { PALETTE, hexToRgb } from '../model/palette'
import { editor } from '../store/editor'

const { selectedColor } = editor

function rgbLabel(color: string): string {
  return hexToRgb(color).join(', ')
}

const selectedLabel = computed(() => rgbLabel(selectedColor.value))
</script>

<template>
  <section class="sidebar-section" aria-labelledby="palette-title">
    <header class="palette__header">
      <h2 id="palette-title" class="sidebar-title">Colors</h2>
      <span class="palette__current">
        <span class="palette__current-swatch" :style="{ background: selectedColor }" />
        {{ selectedLabel }}
      </span>
    </header>
    <div class="palette__grid" role="listbox" aria-label="Color palette">
      <button
        v-for="color in PALETTE"
        :key="color"
        type="button"
        class="swatch"
        :class="{ 'swatch--selected': color === selectedColor }"
        :style="{ background: color }"
        :title="rgbLabel(color)"
        role="option"
        :aria-selected="color === selectedColor"
        :aria-label="rgbLabel(color)"
        @click="editor.selectColor(color)"
      />
    </div>
  </section>
</template>

<style scoped>
.palette__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.palette__current {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-dim);
  font-variant-numeric: tabular-nums;
}

.palette__current-swatch {
  width: 14px;
  height: 14px;
  border: 1px solid var(--color-border-strong);
  border-radius: 3px;
}

.palette__grid {
  display: grid;
  grid-template-columns: repeat(25, 1fr);
  gap: 1px;
}

.swatch {
  aspect-ratio: 1;
  min-width: 0;
  padding: 0;
  border: none;
  border-radius: 1px;
  cursor: pointer;
}

.swatch:hover {
  position: relative;
  z-index: 1;
  outline: 1px solid rgb(255 255 255 / 60%);
}

.swatch--selected,
.swatch--selected:hover {
  position: relative;
  z-index: 2;
  outline: 2px solid #fff;
  box-shadow: 0 0 0 3px #000;
}
</style>
