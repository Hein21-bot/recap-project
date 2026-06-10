import { createRouter, createWebHistory } from 'vue-router';
import Step0Upload from './pages/Step0Upload.vue';
import Step1Transcribe from './pages/Step1Transcribe.vue';
import Step2Translate from './pages/Step2Translate.vue';
import Step4Audio from './pages/Step4Audio.vue';
import Step5Sync from './pages/Step5Sync.vue';
import Step6Subtitle from './pages/Step6Subtitle.vue';
import Step7Export from './pages/Step7Export.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/step0' },
    { path: '/step0', component: Step0Upload },
    { path: '/step1', component: Step1Transcribe },
    { path: '/step2', component: Step2Translate },
    { path: '/step4', component: Step4Audio },
    { path: '/step5', component: Step5Sync },
    { path: '/step6', component: Step6Subtitle },
    { path: '/step7', component: Step7Export },
  ]
});
