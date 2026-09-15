<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Watermark</h2>
    <p class="text-gray-500 text-sm mb-6">
      Export video ပေါ်မှာ တင်မယ့် watermark image နဲ့ ထောင့်နေရာ ကို ရွေးပါ။
    </p>

    <p v-if="error" class="mb-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
      {{ error }}
    </p>

    <div v-if="images.length" class="grid grid-cols-2 gap-4 mb-8">
      <button
        v-for="img in images" :key="img"
        @click="selected = img"
        class="text-left p-3 rounded-2xl border-2 transition-all"
        :class="selected === img
          ? 'border-sky-500 bg-sky-500/10'
          : 'border-gray-800 bg-gray-900 hover:border-gray-700'"
      >
        <div class="aspect-video rounded-lg bg-black/40 flex items-center justify-center overflow-hidden mb-2">
          <img :src="api.assetUrl(img)" :alt="img" class="max-w-full max-h-full object-contain" />
        </div>
        <span class="block text-xs text-gray-400 truncate">{{ img }}</span>
      </button>
    </div>
    <p v-else-if="!error" class="text-sm text-gray-500 mb-8">Loading...</p>

    <p class="text-sm text-gray-400 mb-2">Watermark ဘယ်ထောင့်မှာ တင်မလဲ</p>
    <div class="relative aspect-video rounded-xl border border-gray-800 bg-black/40 mb-4 overflow-hidden">
      <!-- Live preview: watermark scaled + positioned exactly like the export -->
      <img
        v-if="selected"
        :src="api.assetUrl(selected)"
        class="absolute pointer-events-none opacity-80"
        :style="previewStyle"
      />
      <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2 p-2">
        <button
          v-for="p in positions" :key="p.value"
          @click="position = p.value"
          class="rounded-lg border-2 flex text-xs font-medium transition-all"
          :class="[
            p.align,
            position === p.value ? 'border-sky-500 bg-sky-500/10 text-sky-400' : 'border-gray-800 hover:border-gray-700 text-gray-600',
          ]"
        >
          <span class="p-1.5">{{ p.label }}</span>
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between mb-3">
      <label class="text-sm text-gray-400 shrink-0 mr-4">Size</label>
      <input
        type="range" min="6" max="35" step="1"
        v-model.number="sizePct"
        class="flex-1 accent-sky-500"
      />
      <span class="text-sm text-gray-300 w-12 text-right">{{ sizePct }}%</span>
    </div>

    <div class="flex items-center justify-between mb-8">
      <label class="text-sm text-gray-400 shrink-0 mr-4">Padding</label>
      <input
        type="range" min="0" max="10" step="0.5"
        v-model.number="paddingPct"
        class="flex-1 accent-sky-500"
      />
      <span class="text-sm text-gray-300 w-12 text-right">{{ paddingPct }}%</span>
    </div>

    <div class="flex justify-end">
      <button
        @click="saveAndContinue"
        :disabled="saving || !selected"
        class="px-6 py-2.5 rounded-xl text-sm font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-50 transition-colors"
      >
        {{ saving ? "Saving..." : "Save & Continue →" }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/api/pipeline.js";

const router   = useRouter();
const images   = ref([]);
const selected = ref("");
const position = ref("top-right");
const sizePct    = ref(16);
const paddingPct = ref(2);
const error    = ref("");
const saving   = ref(false);

const positions = [
  { value: "top-left",     label: "↖ Top-Left",     align: "items-start justify-start" },
  { value: "top-right",    label: "↗ Top-Right",    align: "items-start justify-end" },
  { value: "bottom-left",  label: "↙ Bottom-Left",  align: "items-end justify-start" },
  { value: "bottom-right", label: "↘ Bottom-Right", align: "items-end justify-end" },
];

// Mirrors the export: watermark width = sizePct% of frame width, margin =
// paddingPct% of frame width from the corner, both resolution-relative.
const previewStyle = computed(() => {
  const style = { width: `${sizePct.value}%` };
  const pad = `${paddingPct.value}%`;
  if (position.value.includes("top"))    style.top = pad;    else style.bottom = pad;
  if (position.value.includes("right"))  style.right = pad;  else style.left = pad;
  return style;
});

async function saveAndContinue() {
  saving.value = true;
  try {
    await api.saveWatermark(selected.value, position.value, sizePct.value, paddingPct.value);
    router.push("/processing");
  } catch (e) {
    error.value = e.message;
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    const [{ images: list }, { image: current, position: currentPos, sizePct: currentSize, paddingPct: currentPadding }] = await Promise.all([
      api.getAssetImages(),
      api.getWatermark(),
    ]);
    images.value = list || [];
    selected.value = current && images.value.includes(current) ? current : images.value[0];
    if (currentPos) position.value = currentPos;
    if (currentSize) sizePct.value = currentSize;
    if (currentPadding != null) paddingPct.value = currentPadding;
  } catch (e) {
    error.value = e.message;
  }
});
</script>
