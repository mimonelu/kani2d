<script setup lang="ts">
import { Crop, FilePlus, FolderOpen, Grid3x3, ImageDown, Save, Scaling } from '@lucide/vue'
import { APP_NAME, UNNAMED_FILE_LABEL } from '../model/constants'
import { editor } from '../store/editor'

const emit = defineEmits<{
  new: []
  resize: []
  trim: []
  guides: []
  load: []
  save: []
  export: []
}>()

const { docName, isDirty, canTrim } = editor
</script>

<template>
  <header class="toolbar">
    <h1 class="logo">{{ APP_NAME }}</h1>
    <nav class="actions" aria-label="File">
      <button type="button" class="button" @click="emit('new')"><FilePlus :size="16" />New</button>
      <button type="button" class="button" @click="emit('resize')"><Scaling :size="16" />Resize</button>
      <button
        type="button"
        class="button"
        title="Trim the canvas to fit the tiles and sprites"
        :disabled="!canTrim"
        @click="emit('trim')"
      >
        <Crop :size="16" />Trim
      </button>
      <button type="button" class="button" title="Set the guide line spacing" @click="emit('guides')">
        <Grid3x3 :size="16" />Guides
      </button>
      <button type="button" class="button" @click="emit('load')"><FolderOpen :size="16" />Load</button>
      <button type="button" class="button" @click="emit('save')"><Save :size="16" />Save</button>
      <button type="button" class="button" @click="emit('export')"><ImageDown :size="16" />Export</button>
    </nav>
    <p class="doc-name" :title="isDirty ? 'Unsaved changes' : undefined">
      <span class="doc-name__text">{{ docName ?? UNNAMED_FILE_LABEL }}</span>
      <span v-if="isDirty" class="doc-name__dirty" aria-label="Unsaved changes">•</span>
    </p>
  </header>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: var(--toolbar-height);
  padding: 0 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-panel);
}

.logo {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--color-accent);
  user-select: none;
}

.actions {
  display: flex;
  gap: 6px;
}

.doc-name {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin-left: auto;
  color: var(--color-text-dim);
}

.doc-name__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-name__dirty {
  color: var(--color-accent);
  font-size: 18px;
  line-height: 1;
}
</style>
