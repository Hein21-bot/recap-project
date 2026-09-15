<template>
  <div class="max-w-3xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Blur Box</h2>
    <p class="text-gray-500 text-sm mb-6">
      Video ပေါ်က ဖုံးချင်တဲ့ နေရာတွေ (ဥပမာ — မူရင်း video ထဲက watermark/logo) ကို rectangle ဆွဲပါ။
      အဲဒီနေရာတွေချည်း blur ဖြစ်မယ် — subtitle မပါဘူး။ Box အများကြီး ဆွဲလို့ရတယ်။
    </p>

    <p v-if="error" class="mb-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
      {{ error }}
    </p>

    <!-- Frame + draw surface -->
    <div
      v-if="!error"
      ref="surface"
      class="relative select-none rounded-xl overflow-hidden border border-gray-800 bg-black cursor-crosshair"
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

      <!-- Saved boxes -->
      <div
        v-for="(b, i) in boxes" :key="i"
        class="absolute border-2 border-amber-400 bg-amber-400/10"
        :style="boxStyleOf(b)"
      >
        <span class="absolute top-0 left-0 bg-amber-500 text-black text-[10px] font-bold px-1">{{ i + 1 }}</span>
      </div>

      <!-- Box currently being drawn -->
      <div
        v-if="draft"
        class="absolute border-2 border-sky-400 bg-sky-400/10"
        :style="boxStyleOf(draft)"
      />

      <div v-if="!frameLoaded" class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
        Frame loading...
      </div>
    </div>

    <!-- Box list -->
    <div v-if="!error && boxes.length" class="mt-4 space-y-2">
      <div v-for="(b, i) in boxes" :key="i"
        class="flex items-center justify-between text-xs text-gray-400 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
        <span>Box {{ i + 1 }}: {{ pct(b.x) }},{{ pct(b.y) }} · {{ pct(b.w) }}×{{ pct(b.h) }}</span>
        <button @click="boxes.splice(i, 1)" class="text-red-400 hover:text-red-300 underline">Remove</button>
      </div>
    </div>
    <p v-else-if="!error" class="mt-4 text-xs text-gray-500">Box မဆွဲရသေးပါ — video ပေါ်မှာ drag ဆွဲပါ</p>

    <div class="mt-8 flex items-center justify-between">
      <button
        @click="skip"
        class="px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-800 hover:bg-gray-700 transition-colors"
      >
        Skip (blur မလုပ်)
      </button>
      <button
        @click="saveAndContinue"
        :disabled="saving"
        class="px-6 py-2.5 rounded-xl text-sm font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-50 transition-colors"
      >
        {{ saving ? "Saving..." : "Save & Continue →" }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/api/pipeline.js";

const router  = useRouter();
const surface = ref(null);
const frameSrc    = ref("");
const frameLoaded = ref(false);
const error   = ref("");
const saving  = ref(false);

// boxes: array of normalized { x, y, w, h } in 0..1
const boxes = ref([]);
// draft: the box currently being drawn (not yet committed)
const draft = ref(null);
const drawing = ref(false);
let startPt = null;

function boxStyleOf(b) {
  return {
    left:  `${b.x * 100}%`,
    top:   `${b.y * 100}%`,
    width: `${b.w * 100}%`,
    height:`${b.h * 100}%`,
  };
}

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
  draft.value = { x: startPt.x, y: startPt.y, w: 0, h: 0 };
}

function onMove(e) {
  if (!drawing.value) return;
  const p = relPoint(e);
  draft.value = {
    x: Math.min(startPt.x, p.x),
    y: Math.min(startPt.y, p.y),
    w: Math.abs(p.x - startPt.x),
    h: Math.abs(p.y - startPt.y),
  };
}

function onUp() {
  if (!drawing.value) return;
  drawing.value = false;
  if (draft.value && draft.value.w >= 0.02 && draft.value.h >= 0.02) {
    boxes.value.push(draft.value);
  }
  draft.value = null;
}

function onFrameError() {
  error.value = "Video frame ကို မရနိုင်ပါ — Step 0 (Download Video) အရင် ပြီးအောင် လုပ်ပါ။";
}

async function skip() {
  saving.value = true;
  try { await api.saveBlurRegions([]); } catch (_) {}
  router.push("/watermark");
}

async function saveAndContinue() {
  saving.value = true;
  try {
    await api.saveBlurRegions(boxes.value);
    router.push("/watermark");
  } catch (e) {
    error.value = e.message;
    saving.value = false;
  }
}

onMounted(async () => {
  frameSrc.value = api.framePreviewUrl(3);
  try {
    const r = await api.getBlurRegions();
    if (Array.isArray(r?.regions)) boxes.value = r.regions;
  } catch (_) {}
});
</script>
