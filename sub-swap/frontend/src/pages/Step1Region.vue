<template>
  <div class="max-w-3xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Select Subtitle Region</h2>
    <p class="text-gray-500 text-sm mb-2">Chinese subtitle ရှိတဲ့ နေရာပေါ်မှာ <strong class="text-white">click ဖိပြီး drag</strong> လုပ်ပါ</p>
    <p class="text-xs text-amber-400 mb-6">👆 ပုံပေါ်မှာ drag လုပ်ပြီး rectangle ဆွဲပါ → ခလုတ် ပေါ်မည် → နှိပ်ပါ</p>

    <div v-if="loading" class="text-gray-500 text-sm py-20 text-center">Frame ထုတ်နေသည်...</div>
    <p v-if="error" class="text-red-400 text-sm mb-4">{{ error }}</p>

    <div v-if="frameUrl" class="space-y-4">
      <!-- Canvas region selector -->
      <div class="relative inline-block w-full border border-gray-700 rounded-xl overflow-hidden">
        <img
          ref="img"
          :src="frameUrl"
          class="w-full block"
          draggable="false"
          @load="syncCanvas"
        />
        <canvas
          ref="canvas"
          class="absolute inset-0 cursor-crosshair"
          style="touch-action: none;"
          @mousedown="startDrag"
          @mousemove="onDrag"
          @mouseup="endDrag"
          @mouseleave="endDrag"
        />
        <!-- Hint overlay when no region yet -->
        <div v-if="!region" class="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
          <div class="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
            ↑ Chinese subtitle ပါတဲ့ နေရာကို drag ဆွဲပါ
          </div>
        </div>
      </div>

      <!-- Region info -->
      <div v-if="region" class="bg-gray-900 border border-emerald-800 rounded-xl p-4 text-sm flex flex-wrap gap-4 items-center">
        <span class="text-gray-400">Region:</span>
        <span class="text-white font-mono">x={{ region.x }} y={{ region.y }} w={{ region.w }} h={{ region.h }}</span>
        <span class="text-emerald-400 ml-auto">✓ ရွေးပြီး</span>
      </div>

      <p class="text-xs text-gray-600">မကျေနပ်ရင် ပြန် drag ဆွဲပြီး replace လုပ်နိုင်သည်</p>

      <!-- Action buttons -->
      <div v-if="region" class="flex gap-3 pt-2">
        <button @click="clearRegion"
          class="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm transition-colors">
          ပြန်ဖျက်ရေးဆွဲ
        </button>
        <button @click="saveRegion" :disabled="saving"
          class="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors">
          {{ saving ? 'Saving...' : 'Confirm & Next Step →' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/api.js';

const router   = useRouter();
const frameUrl = ref('');
const loading  = ref(true);
const error    = ref('');
const saving   = ref(false);

const canvas = ref(null);
const img    = ref(null);
const region = ref(null);

let videoWidth = 1920, videoHeight = 1080;
let isDragging = false;
let startX = 0, startY = 0;

onMounted(async () => {
  try {
    const res = await api.getFrame();
    if (!res.success) throw new Error(res.error || 'Frame ထုတ်မရပါ');
    frameUrl.value = res.frameUrl + '?t=' + Date.now();
    videoWidth  = res.width;
    videoHeight = res.height;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }

  window.addEventListener('resize', syncCanvas);
});

onUnmounted(() => window.removeEventListener('resize', syncCanvas));

function syncCanvas() {
  if (!canvas.value || !img.value) return;
  const w = img.value.clientWidth;
  const h = img.value.clientHeight;
  if (!w || !h) return;
  canvas.value.width  = w;
  canvas.value.height = h;
  canvas.value.style.width  = w + 'px';
  canvas.value.style.height = h + 'px';
  // Redraw existing region if any
  if (region.value) drawRegionDisplay();
}

function getPos(e) {
  const rect = canvas.value.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.value.width  / rect.width),
    y: (e.clientY - rect.top)  * (canvas.value.height / rect.height),
  };
}

function startDrag(e) {
  syncCanvas(); // ensure canvas is sized before first drag
  isDragging = true;
  region.value = null;
  const pos = getPos(e);
  startX = pos.x;
  startY = pos.y;
}

function onDrag(e) {
  if (!isDragging) return;
  const pos = getPos(e);
  const ctx = canvas.value.getContext('2d');
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);

  const x = Math.min(startX, pos.x);
  const y = Math.min(startY, pos.y);
  const w = Math.abs(pos.x - startX);
  const h = Math.abs(pos.y - startY);

  ctx.fillStyle = 'rgba(239,68,68,0.3)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function endDrag(e) {
  if (!isDragging) return;
  isDragging = false;

  const pos = getPos(e);
  const dispX = Math.min(startX, pos.x);
  const dispY = Math.min(startY, pos.y);
  const dispW = Math.abs(pos.x - startX);
  const dispH = Math.abs(pos.y - startY);

  if (dispW < 5 || dispH < 5) return; // too small, ignore

  // Scale display coords → actual video pixel coords
  const scaleX = videoWidth  / canvas.value.width;
  const scaleY = videoHeight / canvas.value.height;

  region.value = {
    x: Math.round(dispX * scaleX),
    y: Math.round(dispY * scaleY),
    w: Math.round(dispW * scaleX),
    h: Math.round(dispH * scaleY),
  };
}

function drawRegionDisplay() {
  if (!region.value || !canvas.value) return;
  const scaleX = canvas.value.width  / videoWidth;
  const scaleY = canvas.value.height / videoHeight;
  const ctx = canvas.value.getContext('2d');
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  ctx.fillStyle = 'rgba(239,68,68,0.3)';
  ctx.fillRect(region.value.x * scaleX, region.value.y * scaleY, region.value.w * scaleX, region.value.h * scaleY);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.strokeRect(region.value.x * scaleX, region.value.y * scaleY, region.value.w * scaleX, region.value.h * scaleY);
}

function clearRegion() {
  region.value = null;
  const ctx = canvas.value.getContext('2d');
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
}

async function saveRegion() {
  saving.value = true;
  error.value = '';
  try {
    const res = await api.saveRegion(region.value);
    if (!res.success) throw new Error(res.error);
    router.push('/step2');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>
