<template>
  <div v-if="logs.length" class="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4 font-mono text-xs text-gray-400 max-h-48 overflow-y-auto space-y-1">
    <div v-for="(line, i) in logs" :key="i" class="leading-relaxed">
      <span class="text-gray-600 select-none mr-2">›</span>{{ line }}
    </div>
    <div v-if="!done" class="flex items-center gap-2 text-sky-500">
      <span class="animate-pulse">●</span> running...
    </div>
  </div>
</template>

<script setup>
defineProps({
  logs: { type: Array, default: () => [] },
  done: { type: Boolean, default: false },
});
</script>
