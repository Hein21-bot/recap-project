import { createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/",        redirect: "/step/0" },
  { path: "/step/0",  component: () => import("./pages/Step0Download.vue") },
  { path: "/step/1",  component: () => import("./pages/Step1Script.vue") },
  { path: "/step/2",  component: () => import("./pages/Step2Voice.vue") },
  { path: "/step/3",  component: () => import("./pages/Step3Tone.vue") },
  { path: "/step/4",  component: () => import("./pages/Step4Format.vue") },
  { path: "/step/5",  component: () => import("./pages/Step5Audio.vue") },
  { path: "/step/6",  component: () => import("./pages/Step6Sync.vue") },
  { path: "/step/7",  component: () => import("./pages/Step7Subtitles.vue") },
  { path: "/step/8",  component: () => import("./pages/Step8Export.vue") },
  { path: "/processing", component: () => import("./pages/StepProcessing.vue") },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
