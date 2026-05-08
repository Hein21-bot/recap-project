<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Set Tone</h2>
    <p class="text-gray-500 text-sm mb-8">ဗီဒီယို mood / tone ရွေးချယ်ပါ</p>

    <div class="grid grid-cols-2 gap-4 mb-8">
      <button
        v-for="t in tones" :key="t.key"
        @click="selected = t.key"
        class="text-left p-4 rounded-2xl border-2 transition-all"
        :class="selected === t.key
          ? 'border-sky-500 bg-sky-500/10'
          : 'border-gray-800 bg-gray-900 hover:border-gray-700'"
      >
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xl">{{ t.emoji }}</span>
          <span class="font-semibold text-sm">{{ t.name }}</span>
        </div>
        <p class="text-xs text-gray-500 leading-relaxed">{{ t.desc }}</p>
        <span class="mt-2 inline-block text-xs text-gray-600">{{ t.speed }}x speed</span>
      </button>
    </div>

    <p v-if="error" class="text-red-400 text-sm mb-4">{{ error }}</p>

    <button @click="confirm" :disabled="saving"
      class="w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50">
      <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
      </svg>
      {{ saving ? "Saving..." : "Confirm & Continue →" }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/api/pipeline.js";
import { usePipelineStore } from "@/stores/pipeline.js";

const store    = usePipelineStore();
const router   = useRouter();
const selected = ref("knowledge");
const saving   = ref(false);
const error    = ref("");

const tones = [
  { key: "knowledge",   emoji: "📚", name: "Knowledge",   desc: "အသိပညာ မျှဝေ — တည်ငြိမ်",     speed: 1.3  },
  { key: "funny",       emoji: "😄", name: "Funny",       desc: "ဖျော်ဖြေ — မြင့်မားသော",         speed: 1.25 },
  { key: "documentary", emoji: "🎥", name: "Documentary", desc: "ဒိုင်ကျူမင်တရီ — နက်ရှိုင်း",   speed: 0.9  },
  { key: "educational", emoji: "🎓", name: "Educational", desc: "ပညာသင် — ရှင်းလင်းတိကျ",        speed: 1.1  },
];

onMounted(async () => {
  const s = await api.getState();
  if (s.step3?.toneKey) selected.value = s.step3.toneKey;
});

async function confirm() {
  saving.value = true;
  error.value  = "";
  try {
    await api.selectTone(selected.value);
    store.loadState();
    router.push("/step/1");
  } catch (e) {
    error.value = e.message;
    saving.value = false;
  }
}
</script>
