import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "@/api/pipeline.js";

export const usePipelineStore = defineStore("pipeline", () => {
  const state      = ref({});
  const activeStep = ref(0);

  async function loadState() {
    state.value = await api.getState();
    // Derive which step we're on from server state
    const s = state.value;
    // New pipeline order: 0 → 2 → 3 → 1 → 4 → 5 → 6 → 7 → 8
    if (s.step8?.completed)      activeStep.value = 8;
    else if (s.step7?.completed) activeStep.value = 8;
    else if (s.step6?.completed) activeStep.value = 7;
    else if (s.step5?.completed) activeStep.value = 6;
    else if (s.step4?.completed) activeStep.value = 5;
    else if (s.step1?.completed) activeStep.value = 4;
    else if (s.step3?.completed) activeStep.value = 1;
    else if (s.step2?.completed) activeStep.value = 3;
    else if (s.step0?.completed) activeStep.value = 2;
    else                         activeStep.value = 0;
  }

  function stepCompleted(n) {
    if (n === 0) return !!state.value.youtubeUrl;
    return !!state.value[`step${n}`]?.completed;
  }

  return { state, activeStep, loadState, stepCompleted };
});
