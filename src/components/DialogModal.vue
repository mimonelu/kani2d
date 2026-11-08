<script setup lang="ts">
import BaseModal from './BaseModal.vue'

withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
    /** 指定しない場合は確認ボタンのみ表示する */
    cancelLabel?: string
    danger?: boolean
  }>(),
  {
    confirmLabel: 'OK',
    cancelLabel: undefined,
    danger: false,
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <BaseModal :title="title" @close="emit('cancel')">
    <p class="message">{{ message }}</p>
    <template #footer>
      <button v-if="cancelLabel" type="button" class="button" @click="emit('cancel')">{{ cancelLabel }}</button>
      <button
        type="button"
        class="button"
        :class="danger ? 'button--danger' : 'button--primary'"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.message {
  white-space: pre-wrap;
}
</style>
