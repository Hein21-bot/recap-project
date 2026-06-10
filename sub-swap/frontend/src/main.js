import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

import Step0Upload    from './pages/Step0Upload.vue';
import Step1Region    from './pages/Step1Region.vue';
import Step2Transcribe from './pages/Step2Transcribe.vue';
import Step3Translate from './pages/Step3Translate.vue';
import Step4Render    from './pages/Step4Render.vue';
import Step5Export    from './pages/Step5Export.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',       redirect: '/step0' },
    { path: '/step0',  component: Step0Upload },
    { path: '/step1',  component: Step1Region },
    { path: '/step2',  component: Step2Transcribe },
    { path: '/step3',  component: Step3Translate },
    { path: '/step4',  component: Step4Render },
    { path: '/step5',  component: Step5Export },
  ]
});

createApp(App).use(router).mount('#app');
