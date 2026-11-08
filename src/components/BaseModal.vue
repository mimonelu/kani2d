<script setup lang="ts">
import { X } from '@lucide/vue'
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'

defineProps<{
  title: string
  wide?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const titleId = useId()
const dialog = ref<HTMLElement>()
let previousFocus: HTMLElement | null = null

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

onMounted(async () => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  const target =
    dialog.value?.querySelector<HTMLElement>('[autofocus]') ??
    dialog.value?.querySelector<HTMLElement>('.modal__body input, .modal__footer .button--primary, .modal__footer .button--danger')
  target?.focus()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  previousFocus?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @pointerdown.self="emit('close')">
      <div
        ref="dialog"
        class="modal"
        :class="{ 'modal--wide': wide }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <header class="modal__header">
          <h2 :id="titleId" class="modal__title">{{ title }}</h2>
          <button type="button" class="icon-button" title="Close" aria-label="Close" @click="emit('close')">
            <X :size="16" />
          </button>
        </header>
        <div class="modal__body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="modal__footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(0 0 0 / 55%);
}

.modal {
  display: flex;
  flex-direction: column;
  width: min(400px, 100%);
  max-height: 100%;
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  background: var(--color-panel);
  box-shadow: 0 16px 48px rgb(0 0 0 / 50%);
}

.modal--wide {
  width: min(720px, 100%);
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 0 16px;
}

.modal__title {
  font-size: 15px;
  font-weight: 600;
}

.modal__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 12px 16px;
  overflow: auto;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 4px 16px 16px;
}
</style>
