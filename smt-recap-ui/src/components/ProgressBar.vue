<template>
  <div v-if="visible" class="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
    <div
      class="h-2 rounded-full transition-all duration-300"
      :class="percent >= 100 ? 'bg-emerald-500' : 'bg-sky-500'"
      :style="{ width: `${percent}%` }"
    />
  </div>
</template>

<script setup>
defineProps({
  percent: { type: Number, default: 0 },
  visible: { type: Boolean, default: true },
});
</script>
