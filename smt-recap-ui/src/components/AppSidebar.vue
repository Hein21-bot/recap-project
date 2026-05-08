<template>
  <aside class="w-60 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-screen sticky top-0">
    <!-- Logo -->
    <div class="px-6 py-5 border-b border-gray-800">
      <h1 class="text-lg font-bold text-white tracking-tight">SMT Recap</h1>
      <p class="text-xs text-gray-500 mt-0.5">Myanmar AI Pipeline</p>
    </div>

    <!-- Steps nav -->
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      <router-link
        v-for="(step, index) in steps"
        :key="step.path"
        :to="step.path"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
        :class="linkClass(step)"
      >
        <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          :class="iconClass(step)">
          <svg v-if="isCompleted(step)" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span v-else>{{ index }}</span>
        </span>
        <span class="truncate">{{ step.label }}</span>
      </router-link>
    </nav>

    <!-- Footer -->
    <div class="px-6 py-4 border-t border-gray-800 text-xs text-gray-600">
      v1.0 · localhost:3000
    </div>
  </aside>
</template>

<script setup>
import { usePipelineStore } from "@/stores/pipeline.js";
import { useRoute } from "vue-router";

const store = usePipelineStore();
const route = useRoute();

const steps = [
  { n: 0,    path: "/step/0",    label: "Download Video"  },
  { n: 2,    path: "/step/2",    label: "Select Voice"    },
  { n: 3,    path: "/step/3",    label: "Set Tone"        },
  { n: 1,    path: "/step/1",    label: "Generate Script" },
  { n: null, path: "/processing",label: "Processing"      },
  { n: 8,    path: "/step/8",    label: "Export"          },
];

function isActive(path) {
  return route.path === path;
}

function isProcessingDone() {
  return store.state.step7?.completed;
}

function isCompleted(step) {
  if (step.n === null) return isProcessingDone();
  return store.stepCompleted(step.n);
}

function linkClass(step) {
  if (isActive(step.path)) return "bg-sky-500/10 text-sky-400";
  if (isCompleted(step))   return "text-gray-400 hover:bg-gray-800 hover:text-white";
  return "text-gray-600 hover:bg-gray-800 hover:text-gray-400";
}

function iconClass(step) {
  if (isCompleted(step))     return "bg-emerald-500/20 text-emerald-400";
  if (isActive(step.path))   return "bg-sky-500/20 text-sky-400";
  return "bg-gray-800 text-gray-600";
}
</script>
