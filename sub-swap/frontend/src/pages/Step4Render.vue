<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Render</h2>
    <p class="text-gray-500 text-sm mb-6">Chinese subtitle blur လုပ်ပြီး မြန်မာ subtitle ထည့်မည်</p>

    <div v-if="!loading" class="space-y-4 mb-6">
      <!-- Pipeline summary -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2 text-sm">
        <div class="flex justify-between text-gray-400">
          <span>Blur region</span>
          <span v-if="region" class="text-white font-mono text-xs">x={{ region.x }} y={{ region.y }} w={{ region.w }} h={{ region.h }}</span>
          <span v-else class="text-red-400">မရှိပါ</span>
        </div>
        <div class="flex justify-between text-gray-400">
          <span>Subtitle segments</span>
          <span class="text-white">{{ segCount }}</span>
        </div>
      </div>

      <!-- Anti-detection options -->
      <div class="bg-gray-900 border border-amber-800/50 rounded-xl p-4 space-y-3">
        <p class="text-xs text-amber-400 font-medium mb-3">🛡 Anti-Detection Options</p>

        <label class="flex items-center justify-between cursor-pointer">
          <div>
            <p class="text-sm text-white">Video Flip (Mirror)</p>
            <p class="text-xs text-gray-500">Video ကို horizontal flip လုပ်တာ — visual fingerprint ပြောင်းတယ်</p>
          </div>
          <div class="relative ml-4">
            <input type="checkbox" v-model="flipVideo" class="sr-only" />
            <div class="w-10 h-6 rounded-full transition-colors" :class="flipVideo ? 'bg-sky-600' : 'bg-gray-700'"></div>
            <div class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform" :style="{ transform: flipVideo ? 'translateX(16px)' : 'translateX(0)' }"></div>
          </div>
        </label>

        <label class="flex items-center justify-between cursor-pointer">
          <div>
            <p class="text-sm text-white">Audio Speed +5%</p>
            <p class="text-xs text-gray-500">Audio ကို 1.05x speed up — audio fingerprint ပြောင်းတယ်</p>
          </div>
          <div class="relative ml-4">
            <input type="checkbox" v-model="speedAudio" class="sr-only" />
            <div class="w-10 h-6 rounded-full transition-colors" :class="speedAudio ? 'bg-sky-600' : 'bg-gray-700'"></div>
            <div class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform" :style="{ transform: speedAudio ? 'translateX(16px)' : 'translateX(0)' }"></div>
          </div>
        </label>

        <label class="flex items-center justify-between cursor-pointer">
          <div>
            <p class="text-sm text-white">Pitch Shift +4%</p>
            <p class="text-xs text-gray-500">Audio pitch အနည်းငယ် မြင့်တာ —귀로မသိနိုင်ဘဲ fingerprint ပြောင်းတယ်</p>
          </div>
          <div class="relative ml-4">
            <input type="checkbox" v-model="pitchShift" class="sr-only" />
            <div class="w-10 h-6 rounded-full transition-colors" :class="pitchShift ? 'bg-sky-600' : 'bg-gray-700'"></div>
            <div class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform" :style="{ transform: pitchShift ? 'translateX(16px)' : 'translateX(0)' }"></div>
          </div>
        </label>
      </div>
    </div>

    <button v-if="!done && !loading" @click="run" :disabled="!region || !segCount"
      class="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl font-medium text-sm transition-colors">
      Start Render
    </button>

    <div v-if="loading" class="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
      <div class="flex justify-center mb-3">
        <svg class="animate-spin w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      </div>
      <p class="text-gray-400 text-sm">FFmpeg ဖြင့် render လုပ်နေသည်... ခဏစောင့်ပါ</p>
      <p class="text-gray-600 text-xs mt-1">ဗီဒီယို ရှည်ရင် ကြာနိုင်သည်</p>
    </div>

    <p v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</p>

    <div v-if="done" class="mt-6 bg-emerald-900/30 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-400 text-center">
      ✓ Render ပြီးပါပြီ — Export သွားပြီး download လုပ်ပါ
    </div>

    <div v-if="done" class="mt-4 flex gap-3">
      <button @click="rerender"
        class="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm transition-colors">
        🔄 Re-render
      </button>
      <router-link to="/step5"
        class="flex-1 text-center py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Export →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api/api.js';

const loading    = ref(false);
const done       = ref(false);
const error      = ref('');
const region     = ref(null);
const segCount   = ref(0);

// Anti-detection options — all ON by default
const flipVideo  = ref(true);
const speedAudio = ref(true);
const pitchShift = ref(true);

onMounted(async () => {
  const s = await api.getStatus();
  region.value   = s.blurRegion || null;
  segCount.value = s.segments?.length || 0;
  if (s.step >= 5) done.value = true;
});

async function run() {
  loading.value = true;
  error.value   = '';
  done.value    = false;
  try {
    const res = await api.render({
      flipVideo:  flipVideo.value,
      speedAudio: speedAudio.value,
      pitchShift: pitchShift.value,
    });
    if (!res.success) throw new Error(res.error || 'Render မအောင်မြင်ပါ');
    done.value = true;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function rerender() {
  done.value = false;
  run();
}
</script>
