const BASE = '/api';

async function get(url) {
  const r = await fetch(BASE + url);
  return r.json();
}

async function post(url, body) {
  const r = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function put(url, body) {
  const r = await fetch(BASE + url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

export const api = {
  getStatus: () => get('/status'),

  upload: (file) => {
    const fd = new FormData();
    fd.append('video', file);
    return fetch(BASE + '/upload', { method: 'POST', body: fd }).then(r => r.json());
  },

  getFrame:     ()       => get('/frame'),
  saveRegion:   (region) => post('/frame/region', region),
  transcribe:   ()       => post('/transcribe', {}),
  translate:    ()       => post('/translate', {}),
  saveEdits:    (segments) => put('/translate/edit', { segments }),
  render:       (opts={}) => post('/render', opts),
  reset:        ()       => post('/reset', {}),

  downloadUrl: () => BASE + '/export/download',
};
