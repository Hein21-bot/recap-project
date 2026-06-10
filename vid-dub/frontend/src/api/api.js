const BASE = '/api';

async function post(url, body = {}) {
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function put(url, body = {}) {
  const res = await fetch(BASE + url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function postForm(url, formData) {
  const res = await fetch(BASE + url, { method: 'POST', body: formData });
  return res.json();
}

async function get(url) {
  const res = await fetch(BASE + url);
  return res.json();
}

export const api = {
  reset: () => post('/reset'),
  uploadVideo: (file) => {
    const form = new FormData();
    form.append('video', file);
    return postForm('/upload', form);
  },
  transcribe: () => post('/transcribe'),
  translate: (targetLang) => post('/translate', { targetLang }),
  saveTranslation: (segments) => put('/translate/edit', { segments }),
  generateAudio: () => post('/tts', {}),
  ttsProgressUrl: () => BASE + '/tts/progress',
  syncAudio: () => post('/sync'),
  burnSubtitles: () => post('/subtitle'),
  getStatus: () => get('/export/status'),
  downloadUrl: () => BASE + '/export/download'
};
