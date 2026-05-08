<template>
  <div class="flex min-h-screen">
    <AppSidebar />
    <main class="flex-1 overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import AppSidebar from "@/components/AppSidebar.vue";
import { usePipelineStore } from "@/stores/pipeline.js";

const store = usePipelineStore();
onMounted(() => store.loadState());
</script>
