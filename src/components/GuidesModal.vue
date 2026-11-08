<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseCanvasSize } from '../model/document'
import { editor } from '../store/editor'
import BaseModal from './BaseModal.vue'
import CanvasSizeFields from './CanvasSizeFields.vue'

const emit = defineEmits<{
  close: []
}>()

const { guideSpacing } = editor.doc.value

const widthInput = ref<string | number>(guideSpacing.width)
const heightInput = ref<string | number>(guideSpacing.height)

const width = computed(() => parseCanvasSize(widthInput.value))
const height = computed(() => parseCanvasSize(heightInput.value))
const valid = computed(() => width.value !== null && height.value !== null)

function submit() {
  if (width.value === null || height.value === null) return
  editor.setGuideSpacing({ width: width.value, height: height.value })
  emit('close')
}
</script>

<template>
  <BaseModal title="Guide Lines" @close="emit('close')">
    <form id="guides-form" class="form" @submit.prevent="submit">
      <p class="description">Lines are drawn at these intervals from the top-left of the canvas.</p>
      <CanvasSizeFields v-model:width="widthInput" v-model:height="heightInput" autofocus />
      <p v-if="!valid" class="error-text">Enter whole numbers of 1 or more.</p>
    </form>
    <template #footer>
      <button type="button" class="button" @click="emit('close')">Cancel</button>
      <button type="submit" form="guides-form" class="button button--primary" :disabled="!valid">Apply</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.description {
  color: var(--color-text-dim);
}
</style>
