<script setup lang="ts">
import { computed, ref } from 'vue'
import { DEFAULT_CANVAS_SIZE, UNNAMED_FILE_LABEL } from '../model/constants'
import { parseCanvasSize } from '../model/document'
import { normalizeFileName } from '../model/fileFormat'
import BaseModal from './BaseModal.vue'
import CanvasSizeFields from './CanvasSizeFields.vue'

const emit = defineEmits<{
  close: []
  create: [name: string | undefined, width: number, height: number]
}>()

const nameInput = ref('')
const widthInput = ref<string | number>(DEFAULT_CANVAS_SIZE)
const heightInput = ref<string | number>(DEFAULT_CANVAS_SIZE)

const width = computed(() => parseCanvasSize(widthInput.value))
const height = computed(() => parseCanvasSize(heightInput.value))
const valid = computed(() => width.value !== null && height.value !== null)

function submit() {
  if (width.value === null || height.value === null) return
  emit('create', normalizeFileName(nameInput.value), width.value, height.value)
}
</script>

<template>
  <BaseModal title="New Canvas" @close="emit('close')">
    <form id="new-form" class="form" @submit.prevent="submit">
      <label class="field">
        <span class="field__label">File name</span>
        <input
          v-model="nameInput"
          class="text-input"
          type="text"
          :placeholder="UNNAMED_FILE_LABEL"
          autocomplete="off"
          spellcheck="false"
          autofocus
        />
      </label>
      <CanvasSizeFields v-model:width="widthInput" v-model:height="heightInput" />
      <p v-if="!valid" class="error-text">Enter whole numbers of 1 or more.</p>
    </form>
    <template #footer>
      <button type="button" class="button" @click="emit('close')">Cancel</button>
      <button type="submit" form="new-form" class="button button--primary" :disabled="!valid">Create</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
