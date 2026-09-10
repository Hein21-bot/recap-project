<template>
  <div class="max-w-3xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Subtitle Box</h2>
    <p class="text-gray-500 text-sm mb-6">
      Video ပေါ်မှာ rectangle ဆွဲပါ — အဲဒီနေရာ background ဝါးသွားပြီး subtitle က အဲဒီထဲမှာ ပေါ်မယ်။
      မဆွဲဘဲ Skip နှိပ်ရင် အခုအတိုင်း auto (blur မရှိ)။
    </p>

    <p v-if="error" class="mb-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
      {{ error }}
    </p>

    <!-- Frame + draw surface -->
    <div
      v-if="!error"
      ref="surface"
      class="relative select-none rounded-xl overflow-hidden border border-gray-800 bg-black"
      :class="drawing ? 'cursor-crosshair' : 'cursor-crosshair'"
      @mousedown.prevent="onDown"
      @mousemove.prevent="onMove"
      @mouseup.prevent="onUp"
      @mouseleave="onUp"
    >
      <img
        :src="frameSrc"
        alt="video frame"
        class="block w-full pointer-events-none"
        draggable="false"
        @load="frameLoaded = true"
        @error="onFrameError"
      />

      <!-- The box -->
      <div
        v-if="box && frameLoaded"
        class="absolute border-2 border-sky-400 bg-sky-400/10"
        :style="boxStyle"
      >
        <span
          class="absolute inset-0 flex items-center justify-center text-center text-[10px] leading-tight text-yellow-300 font-semibold px-1"
          style="backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);"
        >
          စာတန်းထိုး ဒီနေရာမှာ ပေါ်မယ်
        </span>
      </div>

      <div v-if="!frameLoaded" class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
        Frame loading...
      </div>
    </div>

    <div v-if="!error" class="mt-3 flex items-center gap-3 text-xs text-gray-500">
      <span v-if="box">
        Box: {{ pct(box.x) }},{{ pct(box.y) }} · {{ pct(box.w) }}×{{ pct(box.h) }}
      </span>
      <span v-else>Box မဆွဲရသေးပါ</span>
      <button v-if="box" @click="box = null" class="text-red-400 hover:text-red-300 underline">
        Clear
      </button>
    </div>

    <div class="mt-8 flex items-center justify-between">
      <button
        @click="skip"
        class="px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-800 hover:bg-gray-700 transition-colors"
      >
        Skip (auto)
      </button>
      <button
        @click="saveAndContinue"
        :disabled="saving"
        class="px-6 py-2.5 rounded-xl text-sm font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-50 transition-colors"
      >
        {{ saving ? "Saving..." : (box ? "Save & Continue →" : "Continue →") }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/api/pipeline.js";

const router  = useRouter();
const surface = ref(null);
const frameSrc   = ref("");
const frameLoaded = ref(false);
const error   = ref("");
const saving  = ref(false);

// box: normalized { x, y, w, h } in 0..1, or null
const box = ref(null);
const drawing = ref(false);
let startPt = null;

const boxStyle = computed(() => box.value ? {
  left:  `${box.value.x * 100}%`,
  top:   `${box.value.y * 100}%`,
  width: `${box.value.w * 100}%`,
  height:`${box.value.h * 100}%`,
} : {});

function pct(v) { return `${Math.round(v * 100)}%`; }

function relPoint(e) {
  const r = surface.value.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
  };
}

function onDown(e) {
  if (!frameLoaded.value) return;
  drawing.value = true;
  startPt = relPoint(e);
  box.value = { x: startPt.x, y: startPt.y, w: 0, h: 0 };
}

function onMove(e) {
  if (!drawing.value) return;
  const p = relPoint(e);
  box.value = {
    x: Math.min(startPt.x, p.x),
    y: Math.min(startPt.y, p.y),
    w: Math.abs(p.x - startPt.x),
    h: Math.abs(p.y - startPt.y),
  };
}

function onUp() {
  if (!drawing.value) return;
  drawing.value = false;
  // discard a click / tiny box
  if (box.value && (box.value.w < 0.02 || box.value.h < 0.02)) box.value = null;
}

function onFrameError() {
  error.value = "Video frame ကို မရနိုင်ပါ — Step 0 (Download Video) အရင် ပြီးအောင် လုပ်ပါ။";
}

async function skip() {
  saving.value = true;
  try { await api.saveSubtitleRegion(null); } catch (_) {}
  router.push("/processing");
}

async function saveAndContinue() {
  saving.value = true;
  try {
    await api.saveSubtitleRegion(box.value || null);
    router.push("/processing");
  } catch (e) {
    error.value = e.message;
    saving.value = false;
  }
}

onMounted(async () => {
  frameSrc.value = api.framePreviewUrl(3);
  try {
    const r = await api.getSubtitleRegion();
    if (r?.region) box.value = r.region;
  } catch (_) {}
});
</script>
