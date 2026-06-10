<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Generate Script</h2>
    <p class="text-gray-500 text-sm mb-8">Gemini AI ဖြင့် မြန်မာဘာသာ Script ထုတ်ပါ</p>

    <button @click="generate" :disabled="running"
      class="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors mb-4">
      {{ running ? "Generating..." : "Generate Script" }}
    </button>

    <!-- Spinner while waiting for first log -->
    <div v-if="running && !logs.length" class="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3 text-sm text-gray-400">
      <svg class="animate-spin w-4 h-4 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      Gemini AI ဖြင့် Script ထုတ်နေသည်... ခဏစောင့်ပါ
    </div>

    <p v-if="error" class="mt-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">{{ error }}</p>

    <LogStream :logs="logs" :done="done" />

    <!-- Script editor -->
    <div v-if="script" class="mt-6">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm text-gray-400">Script ({{ wordCount }} words)</span>
        <button @click="save" class="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors">
          Save Changes
        </button>
      </div>
      <textarea
        v-model="script"
        rows="16"
        class="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-sky-500 resize-none transition-colors"
        @input="unsaved = true"
      />
      <p v-if="saved" class="text-emerald-400 text-xs mt-2">✓ Saved</p>
    </div>

    <div v-if="done" class="mt-6 text-right">
      <router-link to="/processing"
        class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Auto Process →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { api } from "@/api/pipeline.js";
import { useSSE, makeJobId } from "@/composables/useSSE.js";
import { usePipelineStore } from "@/stores/pipeline.js";
import LogStream from "@/components/LogStream.vue";

const store = usePipelineStore();
const { logs, done, result, connect, startPolling } = useSSE();

const script   = ref("");
const saved    = ref(false);
const running  = ref(false);
const error    = ref("");
const unsaved  = ref(false);

onBeforeRouteLeave(() => {
  if (unsaved.value) {
    return confirm("Script ကို မသိမ်းရသေးပါ။ ဆက်သွားမှာလား?");
  }
});

const wordCount = computed(() => script.value.split(/\s+/).filter(Boolean).length);

onMounted(async () => {
  const s = await api.getState();
  if (s.step1?.completed) {
    done.value   = true;
    script.value = s.step1.script || "";
  }
});

watch(done, async (isDone) => {
  if (!isDone) return;
  running.value = false;
  if (result.value?.error) {
    error.value = result.value.error;
    return;
  }
  error.value = "";
  const s = await api.getState();
  script.value = s.step1?.script || result.value?.script || "";
  store.loadState();
});

async function generate() {
  running.value = true;
  done.value    = false;
  script.value  = "";
  error.value   = "";
  const jobId = makeJobId();
  connect(jobId);
  await api.generateScript(jobId);

  startPolling(async () => {
    const s = await api.getState();
    if (!s.step1?.completed) return null;
    return { success: true, script: s.step1.script };
  });
}

async function save() {
  await api.saveScript(script.value);
  saved.value = true;
  unsaved.value = false;
  setTimeout(() => (saved.value = false), 2000);
}
</script>
