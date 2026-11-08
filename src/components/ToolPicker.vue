<script setup lang="ts">
import { Eraser, Hand, Move, PaintBucket, Pencil, Pipette } from '@lucide/vue'
import type { Component } from 'vue'
import { TOOLS, toolTitle, type Tool } from '../model/tools'
import { editor } from '../store/editor'

const { activeTool } = editor

const ICONS: Record<Tool, Component> = {
  draw: Pencil,
  erase: Eraser,
  fill: PaintBucket,
  pick: Pipette,
  move: Move,
  pan: Hand,
}
</script>

<template>
  <section class="sidebar-section" aria-labelledby="tools-title">
    <h2 id="tools-title" class="sidebar-title">Tools</h2>
    <div class="choice-list" role="listbox" aria-label="Tool">
      <button
        v-for="info in TOOLS"
        :key="info.tool"
        type="button"
        class="choice-button"
        :class="{ 'choice-button--selected': info.tool === activeTool }"
        :title="toolTitle(info)"
        role="option"
        :aria-selected="info.tool === activeTool"
        :aria-label="toolTitle(info)"
        @click="editor.selectTool(info.tool)"
      >
        <component :is="ICONS[info.tool]" :size="18" />
      </button>
    </div>
  </section>
</template>
