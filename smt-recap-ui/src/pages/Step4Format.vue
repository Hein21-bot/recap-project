<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Format Vocal</h2>
    <p class="text-gray-500 text-sm mb-8">Script ကို TTS အတွက် pause markers ထည့်ပြင်ဆင်မည်</p>

    <button @click="run" :disabled="running || done"
      class="w-full py-3 rounded-xl text-sm font-medium transition-colors"
      :class="done ? 'bg-emerald-600 cursor-default' : 'bg-sky-600 hover:bg-sky-500 disabled:opacity-40'">
      {{ done ? "✓ Formatted" : running ? "Formatting..." : "Format Vocal Script" }}
    </button>

    <p v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</p>

    <div v-if="formattedText" class="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
      {{ formattedText }}
    </div>

    <div v-if="done" class="mt-6 text-right">
      <router-link to="/step/5"
        class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Generate Audio →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "@/api/pipeline.js";
import { usePipelineStore } from "@/stores/pipeline.js";

const store         = usePipelineStore();
const done          = ref(false);
const running       = ref(false);
const formattedText = ref("");
const error         = ref("");

onMounted(async () => {
  const s = await api.getState();
  if (s.step4?.completed) done.value = true;
});

async function run() {
  running.value = true;
  error.value   = "";
  try {
    const res = await api.formatVocal();
    if (res.error) throw new Error(res.error);
    formattedText.value = res.formattedText || "";
    done.value          = true;
    store.loadState();
  } catch (e) {
    error.value = e.message;
  } finally {
    running.value = false;
  }
}
</script>
