import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { ENV } from './env.js';
import { ICONS, barcode } from './icons.js';

const $ = (s) => document.querySelector(s);
const MB = 1024 * 1024;
const DRAFT_KEY = 'bog-draft-v1';
const SENT_KEY = 'bog-sent-v1'; // packages sent from this browser, with their tracking tokens
const BUCKET = 'attachments';
const MAX_ITEMS = 20; // matches create_package() in supabase/migrations/004_limits.sql

const TYPES = {
  note: {
    label: 'Note',
    fields: [{ k: 'text', label: 'Note', type: 'textarea', ph: 'write something...', req: true, max: 3000 }],
  },
  photo: {
    label: 'Photo',
    fields: [
      { k: 'file', label: 'Photo', type: 'file', accept: 'image/*', req: true, maxMB: 10 },
      { k: 'caption', label: 'Caption', ph: 'us, that one summer', max: 120 },
    ],
  },
  song: {
    label: 'Song',
    fields: [
      { k: 'url', label: 'Spotify / YouTube / Apple Music link', type: 'url', ph: 'https://open.spotify.com/track/...', req: true },
      { k: 'caption', label: 'Why this song?', ph: 'reminds me of you', max: 200 },
    ],
  },
  video: {
    label: 'Video',
    fields: [
      { k: 'file', label: 'Upload a video', type: 'file', accept: 'video/*', maxMB: 50 },
      { k: 'url', label: '…or paste a YouTube link', type: 'url', ph: 'https://youtu.be/...' },
      { k: 'caption', label: 'Caption', ph: 'watch this when you miss me', max: 200 },
    ],
    validate: (d) => (d.file || d.url ? '' : 'add a video file or a link'),
  },
  gift: {
    label: 'Gift',
    fields: [
      { k: 'url', label: 'Gift card / e-gift link', type: 'url', ph: 'https://…', req: true },
      { k: 'note', label: 'Note', type: 'textarea', ph: 'treat yourself (on me)', max: 300 },
    ],
  },
  voice: {
    label: 'Voice',
    fields: [{ k: 'file', label: 'Voice note (up to 2 minutes)', type: 'record', maxSec: 120, maxMB: 10, req: true, reqMsg: 'record something first' }],
  },
  drawing: {
    label: 'Drawing',
    fields: [
      { k: 'file', label: 'Draw something', type: 'draw', req: true, reqMsg: 'draw something first' },
      { k: 'caption', label: 'Caption', ph: 'a masterpiece, obviously', max: 120 },
    ],
  },
  location: {
    label: 'Location',
    fields: [
      { k: 'name', label: 'Place name', ph: 'the bench by the river', req: true, max: 80 },
      { k: 'url', label: 'Map link (Google Maps, Apple Maps…)', type: 'url', ph: 'https://maps.google.com/…' },
      { k: 'note', label: 'Why this place?', type: 'textarea', ph: 'where it all started', max: 300 },
    ],
  },
  coupon: {
    label: 'Coupon',
    fields: [
      { k: 'title', label: 'Good for', ph: 'one free hug', req: true, max: 60 },
      { k: 'details', label: 'Fine print', ph: 'redeemable anytime, no questions asked', max: 160 },
      { k: 'expires', label: 'Expires (optional)', type: 'date' },
    ],
  },
  news: {
    label: 'News',
    fields: [
      { k: 'url', label: 'Article link', type: 'url', ph: 'https://…', req: true },
      { k: 'headline', label: 'Headline (optional)', ph: 'paste the title', max: 140 },
      { k: 'note', label: 'Why you’re sending it', type: 'textarea', ph: 'this made me think of you', max: 300 },
    ],
  },
};
// Fields whose value is a file to upload (picked, recorded or drawn).
const isFileField = (f) => ['file', 'record', 'draw'].includes(f.type);

// ---------- tiny helpers ----------
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k.startsWith('on') || (k in el && typeof el[k] !== 'object')) el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter((c) => c != null && c !== false));
  return el;
}
// Each SVG copy gets its own gradient/mask ids; a shared id resolves to the first
// copy in the DOM, which breaks when that copy sits inside a hidden section.
let iconSeq = 0;
const iconEl = (type, cls = 'icon') => {
  const s = h('span', { className: cls });
  const n = ++iconSeq;
  // Inner .float layer carries the idle float, so it doesn't fight hover/pop transforms.
  s.innerHTML = `<span class="float">${ICONS[type].replace(/(id="|url\(#)([\w-]+)/g, `$1$2-${n}`)}</span>`;
  return s;
};
const rid = () => crypto.randomUUID().slice(0, 8);
const safeUrl = (u) => {
  try {
    const url = new URL(u);
    return ['https:', 'http:', 'blob:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
};
let toastTimer, toastExpire;
// action: { label, run, expire } adds a button (e.g. undo); expire runs once it's no longer offered.
function toast(msg, action = null) {
  const t = $('#toast');
  toastExpire?.();
  toastExpire = action?.expire || null;
  const hide = () => { t.classList.remove('show'); toastExpire?.(); toastExpire = null; };
  t.replaceChildren(msg, action
    ? h('button', { type: 'button', className: 'toast-act', onclick: () => { toastExpire = null; action.run(); hide(); } }, action.label)
    : '');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, action ? 6000 : 3200);
}
const b64encode = (obj) => {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64decode = (s) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
};

const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
const fmtWhen = (d) => d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  const clock = `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return d ? `${d} ${d === 1 ? 'day' : 'days'}, ${clock}` : clock;
}
// Value for a datetime-local input, in the viewer's own timezone.
const localInputValue = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

let clientP;
function getClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  clientP ??= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm')
    .then((m) => m.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  return clientP;
}

// ---------- state ----------
const state = { to: '', from: '', openAt: '', items: [] };
const files = new Map(); // item id -> File (not persisted)

function saveDraft() {
  try {
    const items = state.items.filter((i) => !files.has(i.id));
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...state, items }));
  } catch {}
}
function loadSent() {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) || '[]'); } catch { return []; }
}
function saveSent(list) {
  try { localStorage.setItem(SENT_KEY, JSON.stringify(list.slice(0, 30))); } catch {}
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d) Object.assign(state, { to: d.to || '', from: d.from || '', openAt: d.openAt || '', items: d.items || [] });
  } catch {}
}

// ---------- shared decorations ----------
function paintBarcodes(root = document) {
  root.querySelectorAll('.barcode[data-seed]').forEach((el) => {
    if (!el.firstChild) el.innerHTML = barcode(+el.dataset.seed);
  });
}

// ---------- editor ----------
function renderCatalog() {
  $('#catalog').replaceChildren(
    ...Object.entries(TYPES).map(([type, T]) =>
      h('button', { type: 'button', className: 'add', onclick: () => openForm(type) },
        iconEl(type), h('span', {}, `+ ${T.label}`)))
  );
}

const fmtSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

function summary(it) {
  if (it.type === 'note') return it.text;
  if (it.type === 'voice') return `voice note${it.seconds ? ` · ${fmtSec(it.seconds)}` : ''}`;
  if (it.type === 'drawing') return it.caption || 'a drawing';
  if (it.type === 'location') return it.name;
  if (it.type === 'gift') return it.note || hostOf(it.url);
  if (it.type === 'news') return it.headline || hostOf(it.url);
  if (it.type === 'coupon') return it.title;
  if (it.type === 'song') { try { return it.caption || new URL(it.url).hostname.replace('www.', ''); } catch { return it.url; } }
  return it.caption || it.fileName || it.url || '';
}

// Receipt-style cart: one line per type with its quantity, items indented underneath.
function renderCart() {
  const cart = $('#cart');
  $('#emptyCart').hidden = !state.items.length;
  if (!state.items.length) {
    cart.replaceChildren(h('li', { className: 'empty' }, 'nothing tucked in yet'));
    return;
  }
  const rows = [];
  for (const [type, T] of Object.entries(TYPES)) {
    const group = state.items.filter((it) => it.type === type);
    if (!group.length) continue;
    rows.push(h('li', { className: 'group' },
      h('span', { className: 'ci' }, T.label.toUpperCase()),
      h('span', { className: 'leader', ariaHidden: 'true' }),
      h('span', { className: 'cq', ariaLabel: `quantity ${group.length}` }, `×${group.length}`)));
    group.forEach((it, n) => {
      const name = `${T.label} ${n + 1}`;
      rows.push(h('li', { className: 'sub' },
        h('button', { type: 'button', className: 'cd', title: 'Edit', onclick: () => openForm(type, it) },
          summary(it) || name),
        h('button', { type: 'button', className: 'ed', ariaLabel: `Edit ${name}`, onclick: () => openForm(type, it) }, 'edit'),
        h('button', { type: 'button', className: 'rm', title: 'Remove', ariaLabel: `Remove ${name}`, onclick: () => removeItem(it.id) }, '×')));
    });
  }
  cart.replaceChildren(...rows);
}

function removeItem(id) {
  const it = state.items.find((i) => i.id === id);
  if (it?.local) URL.revokeObjectURL(it.local);
  files.delete(id);
  state.items = state.items.filter((i) => i.id !== id);
  renderCart();
  saveDraft();
  resetLink();
}

// One click, no confirm dialog: the toast offers undo instead. Blob previews are only
// released once undo is no longer possible.
function emptyCart() {
  if (!state.items.length) return;
  const items = state.items;
  const kept = new Map(files);
  state.items = [];
  files.clear();
  renderCart();
  saveDraft();
  resetLink();
  toast(`cart emptied (${items.length} ${items.length === 1 ? 'thing' : 'things'})`, {
    label: 'undo',
    run: () => {
      state.items = [...items, ...state.items];
      kept.forEach((f, id) => files.set(id, f));
      renderCart();
      saveDraft();
      resetLink();
    },
    expire: () => items.forEach((i) => i.local && URL.revokeObjectURL(i.local)),
  });
}

// In-dialog recorder for voice notes. Exposes the recording as a File via getFile().
function recorderWidget(f, item) {
  const maxSec = f.maxSec || 120;
  let rec = null, stream = null, chunks = [], file = null, timer = null, seconds = 0;
  const label = h('span', { className: 'rec-label' }, 'Record');
  const btn = h('button', { type: 'button', className: 'rec-btn' }, h('span', { className: 'rec-dot' }), label);
  const time = h('span', { className: 'rec-time' }, '0:00');
  const kept = item && files.has(item.id);
  const status = h('small', { className: 'keep' }, kept ? `current: ${fmtSec(item.seconds || 0)} recording · record again to replace it` : 'not recorded yet');
  const audio = h('audio', { controls: true, className: 'rec-play', hidden: true });
  const wrap = h('div', { className: 'field recorder' }, h('span', {}, f.label), h('div', { className: 'rec-row' }, btn, time), status, audio);

  const release = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  const stop = () => { clearInterval(timer); if (rec?.state === 'recording') rec.stop(); };
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { status.textContent = "this browser can't record audio"; return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { status.textContent = 'microphone blocked. allow it in your browser to record'; return; }
    chunks = [];
    rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      release();
      const type = (rec.mimeType || 'audio/webm').split(';')[0];
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      file = new File(chunks, `voice.${ext}`, { type });
      if (audio.src) URL.revokeObjectURL(audio.src);
      audio.src = URL.createObjectURL(file);
      audio.hidden = false;
      wrap.classList.remove('live');
      label.textContent = 'Record again';
      status.textContent = `recorded ${fmtSec(seconds)} · listen back, or record again`;
    };
    rec.start();
    const startedAt = Date.now();
    seconds = 0;
    time.textContent = '0:00';
    audio.hidden = true;
    wrap.classList.add('live');
    label.textContent = 'Stop';
    status.textContent = `recording… (stops by itself at ${fmtSec(maxSec)})`;
    timer = setInterval(() => {
      seconds = Math.floor((Date.now() - startedAt) / 1000);
      time.textContent = fmtSec(seconds);
      if (seconds >= maxSec) stop();
    }, 250);
  }
  btn.onclick = () => (rec?.state === 'recording' ? stop() : start());

  return {
    el: wrap,
    async getFile() {
      if (rec?.state === 'recording') await new Promise((r) => { rec.addEventListener('stop', () => setTimeout(r), { once: true }); stop(); });
      return file;
    },
    meta: () => (file ? { seconds } : {}),
    stop() { stop(); release(); },
  };
}

// In-dialog sketch pad. Draws at 2x for crisp lines; exported as a PNG.
function drawWidget(f, item) {
  const COLORS = ['#2b211b', '#c8372f', '#2f6db5', '#3f8a55', '#e0a526', '#e27aa0'];
  const SIZES = { thin: 2, med: 5, thick: 11 };
  let color = COLORS[0], size = SIZES.med, strokes = [], cur = null;
  const canvas = h('canvas', { className: 'pad', width: 720, height: 480, ariaLabel: 'drawing pad' });
  const ctx = canvas.getContext('2d');
  const line = (s, a, b) => {
    ctx.strokeStyle = s.color; ctx.lineWidth = s.size * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
  };
  const redraw = () => {
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) s.pts.forEach((p, i) => line(s, s.pts[i - 1] || [p[0] - 0.1, p[1]], p));
  };
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (canvas.width / r.width), (e.clientY - r.top) * (canvas.height / r.height)];
  };
  canvas.onpointerdown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    cur = { color, size, pts: [pos(e)] };
    strokes.push(cur);
    line(cur, [cur.pts[0][0] - 0.1, cur.pts[0][1]], cur.pts[0]);
  };
  canvas.onpointermove = (e) => {
    if (!cur) return;
    const p = pos(e);
    line(cur, cur.pts[cur.pts.length - 1], p);
    cur.pts.push(p);
  };
  canvas.onpointerup = canvas.onpointercancel = () => { cur = null; };
  redraw();

  const pick = (group, btnEl) => { group.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btnEl)); };
  const swatches = h('div', { className: 'swatches' }, ...COLORS.map((c, i) => {
    const b = h('button', { type: 'button', className: `swatch${i ? '' : ' on'}`, style: `--c:${c}`, ariaLabel: `colour ${i + 1}` });
    b.onclick = () => { color = c; pick(swatches, b); };
    return b;
  }));
  const sizes = h('div', { className: 'sizes' }, ...Object.entries(SIZES).map(([name, px]) => {
    const b = h('button', { type: 'button', className: `size${name === 'med' ? ' on' : ''}` }, name);
    b.onclick = () => { size = px; pick(sizes, b); };
    return b;
  }));
  const tools = h('div', { className: 'pad-tools' }, swatches, sizes,
    h('span', { className: 'pad-edit' },
      h('button', { type: 'button', className: 'clear', onclick: () => { strokes.pop(); redraw(); } }, 'undo'),
      h('button', { type: 'button', className: 'clear', onclick: () => { strokes = []; redraw(); } }, 'clear')));
  const kept = item && files.has(item.id);
  const el = h('div', { className: 'field drawer' }, h('span', {}, f.label), canvas, tools,
    kept ? h('small', { className: 'keep' }, 'your current drawing stays unless you draw a new one') : null);

  return {
    el,
    getFile: () => (strokes.length
      ? new Promise((r) => canvas.toBlob((b) => r(new File([b], 'drawing.png', { type: 'image/png' })), 'image/png'))
      : Promise.resolve(null)),
    meta: () => ({}),
    stop() {},
  };
}

let activeWidgets = []; // stopped when the dialog closes (releases the microphone)

function fieldEl(f, item) {
  const props = { name: f.k, placeholder: f.ph || '' };
  let input;
  if (f.type === 'textarea') input = h('textarea', { ...props, rows: 5 });
  else input = h('input', { ...props, type: f.type || 'text', accept: f.type === 'file' ? f.accept : null });
  const keepsFile = f.type === 'file' && item && files.has(item.id);
  if (f.req && !keepsFile) input.required = true;
  if (f.max) input.maxLength = f.max;
  if (item && f.type !== 'file') input.value = item[f.k] || '';
  return h('label', { className: 'field' },
    h('span', {}, f.label),
    input,
    keepsFile ? h('small', { className: 'keep' }, `current: ${item.fileName} (pick a new one to replace it)`) : null);
}

// Add a new item, or edit `item` in place when given.
function openForm(type, item = null) {
  if (!item && state.items.length >= MAX_ITEMS) return toast(`a box holds up to ${MAX_ITEMS} things`);
  const T = TYPES[type];
  const form = $('#dlgForm');
  const dlg = $('#dlg');
  const err = h('p', { className: 'err' });
  if (T.fields.some(isFileField) && !SUPABASE_URL) {
    err.textContent = 'uploads need Supabase set up (see README). links still work.';
  }
  dlg.className = '';
  const widgets = {};
  form.replaceChildren(
    h('button', { type: 'button', className: 'x', ariaLabel: 'Close', onclick: () => dlg.close() }, '×'),
    h('h3', { className: 'dlg-title' }, `${item ? 'EDIT' : 'ADD'} ${T.label.toUpperCase()}`),
    ...T.fields.map((f) => {
      if (f.type === 'record' || f.type === 'draw') {
        const w = widgets[f.k] = (f.type === 'record' ? recorderWidget : drawWidget)(f, item);
        activeWidgets.push(w);
        return w.el;
      }
      return fieldEl(f, item);
    }),
    err,
    h('div', { className: 'row' },
      h('button', { type: 'submit', className: 'btn primary' }, item ? 'Save changes' : 'Add to package'),
      h('button', { type: 'button', className: 'btn', onclick: () => dlg.close() }, 'Cancel')),
  );
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    let file = null;
    for (const f of T.fields) {
      const el = form.elements[f.k];
      if (isFileField(f)) {
        const w = widgets[f.k];
        file = w ? await w.getFile() : el.files[0] || null;
        if (w) Object.assign(data, w.meta());
        if (f.req && !file && !(item && files.has(item.id))) { err.textContent = f.reqMsg || 'add a file first'; return; }
        if (file && f.maxMB && file.size > f.maxMB * MB) { err.textContent = `that file is over ${f.maxMB}MB`; return; }
        if (file && !SUPABASE_URL) { err.textContent = 'uploads need Supabase set up (see README).'; return; }
        data.file = file;
      } else if (el.value.trim()) data[f.k] = el.value.trim();
    }
    const keptFile = !file && item && files.has(item.id);
    const msg = T.validate?.({ ...data, file: file || keptFile });
    if (msg) { err.textContent = msg; return; }
    delete data.file;
    const next = { id: item?.id || rid(), type, ...data };
    if (file) {
      if (item?.local) URL.revokeObjectURL(item.local);
      files.set(next.id, file);
      next.local = URL.createObjectURL(file);
      next.fileName = file.name;
    } else if (keptFile) {
      next.local = item.local;
      next.fileName = item.fileName;
      if (item.seconds) next.seconds = item.seconds;
    }
    if (item) state.items[state.items.findIndex((i) => i.id === item.id)] = next;
    else state.items.push(next);
    renderCart();
    saveDraft();
    resetLink();
    dlg.close();
  };
  dlg.showModal();
  form.querySelector('input, textarea')?.focus();
}

function resetLink() {
  $('#linkout').hidden = true;
}

// The "don't open until" field holds local time; packages store it as UTC.
function openAtISO() {
  if (!state.openAt) return null;
  const d = new Date(state.openAt);
  return isNaN(d) ? null : d.toISOString();
}

async function generate() {
  if (!state.items.length) return toast('tuck at least one thing inside first');
  const openAt = openAtISO();
  if (openAt && new Date(openAt) <= new Date()) return toast("that \"don't open until\" time has already passed");
  const btn = $('#gen');
  btn.disabled = true;
  btn.textContent = 'packing…';
  try {
    const pkg = { to: state.to, from: state.from, items: [], ...(openAt && { openAt }) };
    const base = location.origin + location.pathname;
    let link, trackLink = null;
    const client = await getClient();
    if (client) {
      // The package row goes in first: the database only accepts uploads into the folder
      // of a package created moments ago, and that's also where rate limits are checked.
      const id = crypto.randomUUID();
      const uploads = [];
      for (const it of state.items) {
        const { local, fileName, ...out } = it;
        const f = files.get(it.id);
        if (f) {
          const ext = (f.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8);
          const path = `${ENV}/${id}/${it.id}.${ext}`;
          out.src = client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
          out.mime = f.type;
          uploads.push({ path, f, label: TYPES[it.type].label.toLowerCase() });
        }
        pkg.items.push(out);
      }
      const token = randomToken();
      const { error } = await client.rpc('create_package', { pid: id, penv: ENV, pdata: pkg, ptrack: token });
      if (error) throw error;
      for (const { path, f, label } of uploads) {
        btn.textContent = `uploading ${label}…`;
        const { error: upErr } = await client.storage.from(BUCKET).upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;
      }
      link = `${base}?p=${id}`;
      trackLink = `${base}?track=${id}.${token}`;
      saveSent([{ id, token, to: state.to, createdAt: new Date().toISOString(), openAt }, ...loadSent()]);
      renderSent();
    } else {
      pkg.items = state.items.map(({ local, fileName, ...rest }) => rest);
      link = `${base}#d=${b64encode(pkg)}`;
    }
    $('#linkfield').value = link;
    $('#trackfield').value = trackLink || '';
    $('#trackout').hidden = !trackLink;
    $('#linkout').hidden = false;
    $('#linkfield').select();
    toast('sealed, stamped, ready to ship');
  } catch (e) {
    console.error(e);
    toast(`couldn't pack it: ${e.message || e}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Link';
  }
}

function statusEl(st) {
  if (!st) return h('span', { className: 's-status' }, 'unknown');
  if (st.openedAt) return h('span', { className: 's-status opened' }, `opened ${fmtWhen(new Date(st.openedAt))}`);
  if (st.openAt && new Date(st.openAt) > new Date()) return h('span', { className: 's-status' }, `sealed until ${fmtWhen(new Date(st.openAt))}`);
  return h('span', { className: 's-status' }, 'not opened yet');
}

// Packages sent from this browser, with live opened/not-opened status.
async function renderSent() {
  const list = loadSent().slice(0, 10);
  $('#sent').hidden = !list.length;
  if (!list.length) return;
  const rows = list.map((s) =>
    h('li', {},
      h('span', { className: 's-to' }, `to ${s.to || 'someone'}`),
      h('span', { className: 's-status' }, '…'),
      h('a', { className: 's-track', href: `?track=${s.id}.${s.token}` }, 'track')));
  $('#sentList').replaceChildren(...rows);
  const client = await getClient();
  if (!client) return;
  await Promise.all(list.map(async (s, i) => {
    let data = null;
    try { ({ data } = await client.rpc('get_status', { pid: s.id, ptrack: s.token })); } catch {}
    rows[i].querySelector('.s-status').replaceWith(statusEl(data));
  }));
}

function showEditor() {
  clearInterval(sealTimer);
  document.body.className = 'mode-edit';
  $('#viewer').hidden = true;
  $('#editor').hidden = false;
  window.scrollTo(0, 0);
}

function initEditor() {
  loadDraft();
  const to = $('#to'), from = $('#from');
  to.value = state.to;
  from.value = state.from;
  to.oninput = () => { state.to = to.value; saveDraft(); resetLink(); };
  from.oninput = () => { state.from = from.value; saveDraft(); resetLink(); };
  const openAt = $('#openAt');
  openAt.value = state.openAt;
  const syncOpenAt = () => {
    $('#clearOpenAt').hidden = !openAt.value;
    openAt.min = localInputValue(new Date());
  };
  openAt.oninput = () => { state.openAt = openAt.value; saveDraft(); resetLink(); syncOpenAt(); };
  $('#clearOpenAt').onclick = () => { openAt.value = ''; openAt.oninput(); };
  syncOpenAt();
  $('#digits').textContent = '9405 5118 9956 ' + String(Math.random()).slice(2, 6) + ' 2345 67';
  renderCatalog();
  renderCart();
  $('#gen').onclick = generate;
  $('#emptyCart').onclick = emptyCart;
  $('#preview').onclick = () => {
    if (!state.items.length) return toast('tuck at least one thing inside first');
    const items = state.items.map((it) => (it.local ? { ...it, src: it.local, mime: files.get(it.id)?.type } : it));
    showViewer({ to: state.to, from: state.from, openAt: openAtISO(), items }, { preview: true });
  };
  $('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('#linkfield').value); toast('link copied'); }
    catch { $('#linkfield').select(); toast('press ⌘C / Ctrl+C to copy'); }
  };
  $('#copyTrack').onclick = async () => {
    try { await navigator.clipboard.writeText($('#trackfield').value); toast('tracking link copied'); }
    catch { $('#trackfield').select(); toast('press ⌘C / Ctrl+C to copy'); }
  };
  renderSent();
  showEditor();
}

// ---------- viewer ----------
let sealTimer;

async function fetchPackage(id) {
  const client = await getClient();
  if (!client) throw new Error('no backend configured');
  const { data, error } = await client.rpc('get_package', { pid: id });
  if (error || !data) throw error || new Error('not found');
  return { ...data, id };
}

// First real opening is recorded for the sender. Not from previews, not from the
// sender's own browser (they'd otherwise mark it opened just by checking the link).
async function markOpened(pkg) {
  if (!pkg.id) return;
  if (loadSent().some((s) => s.id === pkg.id)) {
    toast("this is your own package, so opening it here doesn't count");
    return;
  }
  try { await (await getClient())?.rpc('mark_opened', { pid: pkg.id }); } catch {}
}

function showViewer(pkg, { preview = false } = {}) {
  clearInterval(sealTimer);
  document.body.className = 'mode-view';
  $('#editor').hidden = true;
  $('#tracker').hidden = true;
  $('#viewer').hidden = false;
  $('#mail').hidden = false;
  $('#goodies').hidden = true;
  window.scrollTo(0, 0);

  $('#mTo').textContent = pkg.to || 'you';
  $('#ymail').textContent = pkg.to ? `special delivery for ${pkg.to}` : 'special delivery';
  $('#mFrom').textContent = pkg.from || 'someone who cares';
  $('#vfoot').textContent = pkg.id && !preview ? 'the sender will see when this package is opened' : 'made with care';

  const back = $('#vback');
  if (preview) {
    back.textContent = 'Edit package';
    back.onclick = (e) => { e.preventDefault(); showEditor(); };
  } else {
    back.textContent = 'Make your own';
    back.onclick = null;
    back.href = location.pathname;
  }

  const parcel = $('#parcel');
  const tap = $('#tap');
  const skip = $('#skipWait');
  parcel.classList.remove('open');
  skip.hidden = true;

  // While sealed the server only sends a count; previews and URL links have the items.
  const count = pkg.count ?? (pkg.items || []).length;
  let peeking = false;
  $('#pInside').replaceChildren(...Array.from({ length: Math.min(count, 12) }, (_, i) =>
    h('span', { className: 'lump', style: `--i:${i}` })));
  parcel.classList.remove('peek');

  const unseal = () => {
    clearInterval(sealTimer);
    parcel.classList.remove('sealed');
    parcel.disabled = false;
    skip.hidden = true;
    tap.textContent = 'tap to open';
  };

  parcel.onclick = () => {
    // Still sealed: lift the lid a crack. Only the number of things shows, never what they are.
    if (parcel.classList.contains('sealed')) {
      if (peeking) return;
      peeking = true;
      parcel.classList.add('peek');
      tap.textContent = count === 1 ? 'one little thing inside…' : `${count} little things inside…`;
      setTimeout(() => { parcel.classList.remove('peek'); peeking = false; tick(); }, 2600);
      return;
    }
    parcel.classList.add('open');
    parcel.disabled = true;
    if (!preview) markOpened(pkg);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => renderGoodies(pkg), reduce ? 0 : 900);
  };

  const until = pkg.openAt ? new Date(pkg.openAt) : null;
  if (!until || isNaN(until) || until <= new Date()) {
    if (pkg.sealed) { tap.textContent = 'unsealing…'; parcel.disabled = true; refetch(); return; }
    unseal();
    return;
  }

  // Sealed: show the sticker and a live countdown. With a backend the contents aren't
  // even here yet (pkg.sealed); they're fetched once the time comes.
  parcel.classList.add('sealed');
  parcel.disabled = false;
  const tick = () => {
    const left = until - Date.now();
    if (left > 0) { if (!peeking) tap.textContent = `opens in ${countdown(left)}`; return; }
    clearInterval(sealTimer);
    if (pkg.sealed) { parcel.disabled = true; refetch(); }
    else unseal();
  };
  tick();
  sealTimer = setInterval(tick, 1000);
  if (preview) {
    skip.hidden = false;
    skip.onclick = unseal;
  }

  async function refetch() {
    tap.textContent = 'unsealing…';
    try {
      const fresh = await fetchPackage(pkg.id);
      if (fresh.sealed) { setTimeout(refetch, 5000); return; } // clocks a few seconds apart
      pkg = fresh;
      unseal();
    } catch (e) {
      console.error(e);
      tap.textContent = "couldn't unseal it, try reloading";
    }
  }
}

function renderGoodies(pkg) {
  $('#mail').hidden = true;
  $('#goodies').hidden = false;
  $('#gfrom').textContent = pkg.from ? `from ${pkg.from}, with love` : '';
  const items = (pkg.items || []).filter((it) => TYPES[it.type]);
  $('#goodieGrid').replaceChildren(
    ...items.map((it, i) =>
      h('button', { type: 'button', className: 'goodie', style: `--i:${i}`, onclick: () => openItem(it) },
        iconEl(it.type),
        h('span', { className: 'chip' }, TYPES[it.type].label)))
  );
}

function embedFor(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'open.spotify.com') {
    const m = u.pathname.match(/\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/);
    if (m) return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: m[1] === 'track' ? 152 : 352 };
  }
  let yt = null;
  if (host === 'youtu.be') yt = u.pathname.slice(1);
  else if (host.endsWith('youtube.com')) yt = u.searchParams.get('v') || u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/)?.[1];
  if (yt && /^[\w-]{6,20}$/.test(yt)) return { src: `https://www.youtube-nocookie.com/embed/${yt}`, video: true };
  if (host === 'music.apple.com') return { src: `https://embed.music.apple.com${u.pathname}${u.search}`, height: 175 };
  return null;
}

function embedEl(url) {
  const em = embedFor(url);
  if (!em) {
    const href = safeUrl(url);
    return href ? h('a', { className: 'btn primary', href, target: '_blank', rel: 'noopener noreferrer' }, 'open link ↗') : null;
  }
  return h('iframe', {
    src: em.src, className: em.video ? 'embed ratio' : 'embed', height: em.height || null,
    allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture', loading: 'lazy',
    title: 'embedded media', allowFullscreen: true,
  });
}

function typeOut(el, text) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || text.length > 600) { el.textContent = text; return; }
  let i = 0;
  const tick = () => {
    el.textContent = text.slice(0, ++i);
    if (i < text.length && el.isConnected) setTimeout(tick, 22 + Math.random() * 30);
  };
  tick();
}

function openItem(it) {
  const dlg = $('#dlg');
  const form = $('#dlgForm');
  let body;
  if (it.type === 'note') {
    const p = h('p', { className: 'note-paper' });
    body = h('div', { className: 'paper' }, p);
    setTimeout(() => typeOut(p, it.text || ''), 150);
  } else if (it.type === 'photo') {
    const src = safeUrl(it.src);
    body = h('figure', { className: 'polaroid' },
      src ? h('img', { src, alt: it.caption || 'a photo for you' }) : h('p', {}, 'photo missing'),
      it.caption ? h('figcaption', {}, it.caption) : null);
  } else if (it.type === 'song') {
    body = h('div', { className: 'media' }, embedEl(it.url), it.caption ? h('p', { className: 'cap' }, it.caption) : null);
  } else if (it.type === 'video') {
    const src = safeUrl(it.src);
    body = h('div', { className: 'media' },
      src ? h('video', { src, controls: true, playsInline: true, className: 'vid' }) : embedEl(it.url),
      it.caption ? h('p', { className: 'cap' }, it.caption) : null);
  } else if (it.type === 'gift') {
    const href = safeUrl(it.url);
    body = h('div', { className: 'giftcard' },
      h('span', { className: 'g-ribbon', ariaHidden: 'true' }),
      h('p', { className: 'g-kicker' }, 'a little gift for you'),
      it.note ? h('p', { className: 'g-note' }, it.note) : null,
      href ? h('a', { className: 'btn primary', href, target: '_blank', rel: 'noopener noreferrer' }, 'open your gift ↗') : null);
  } else if (it.type === 'voice') {
    const src = safeUrl(it.src);
    body = h('div', { className: 'voicebox' },
      h('p', { className: 'v-kicker' }, `a voice note${it.seconds ? ` · ${fmtSec(it.seconds)}` : ''}`),
      src ? h('audio', { src, controls: true, className: 'v-audio' }) : h('p', {}, 'recording missing'));
  } else if (it.type === 'drawing') {
    const src = safeUrl(it.src);
    body = h('figure', { className: 'sketch' },
      src ? h('img', { src, alt: it.caption || 'a drawing for you' }) : h('p', {}, 'drawing missing'),
      it.caption ? h('figcaption', {}, it.caption) : null);
  } else if (it.type === 'location') {
    // Embed by coordinates when the map link has them, else by name (unless only a link was given).
    const link = safeUrl(it.url);
    const at = (it.url || '').match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || (it.url || '').match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const q = at ? `${at[1]},${at[2]}` : !link ? it.name : null;
    const open = link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.name || '')}`;
    body = h('div', { className: 'mapcard' },
      q ? h('iframe', { className: 'map', src: `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`, loading: 'lazy', title: `map of ${it.name}` }) : null,
      h('h4', {}, it.name || 'a place'),
      it.note ? h('p', { className: 'cap' }, it.note) : null,
      h('a', { className: 'btn', href: open, target: '_blank', rel: 'noopener noreferrer' }, 'open in maps ↗'));
  } else if (it.type === 'news') {
    const href = safeUrl(it.url);
    const host = hostOf(it.url);
    body = h('article', { className: 'clipping' },
      h('p', { className: 'n-mast' }, 'THE DAILY YOU'),
      h('h4', {}, it.headline || 'something worth reading'),
      it.note ? h('p', { className: 'n-note' }, it.note) : null,
      href ? h('a', { className: 'btn', href, target: '_blank', rel: 'noopener noreferrer' }, `read it on ${host || 'the web'} ↗`) : null);
  } else if (it.type === 'coupon') {
    let exp = null;
    if (it.expires) {
      const d = new Date(it.expires + 'T00:00:00');
      if (!isNaN(d)) exp = `expires ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    body = h('div', { className: 'coupon' },
      h('p', { className: 'c-kicker' }, '★ OFFICIAL COUPON ★'),
      h('p', { className: 'c-good' }, 'good for'),
      h('h4', {}, it.title || 'something nice'),
      it.details ? h('p', { className: 'c-fine' }, it.details) : null,
      h('div', { className: 'c-foot' }, h('span', {}, exp || 'never expires'), h('span', {}, 'qty: 1')));
  }
  dlg.className = 'view';
  form.onsubmit = null;
  form.replaceChildren(
    h('button', { type: 'button', className: 'x', ariaLabel: 'Close', onclick: () => dlg.close() }, '×'),
    body,
  );
  dlg.showModal();
}

// ---------- tracking (sender only) ----------
async function showTracker(param) {
  document.body.className = 'mode-edit';
  $('#tracker').hidden = false;
  const [id, token] = param.split('.');
  const stamp = $('#tStamp');
  try {
    const client = await getClient();
    if (!client || !id || !token) throw new Error('bad link');
    const { data, error } = await client.rpc('get_status', { pid: id, ptrack: token });
    if (error || !data) throw error || new Error('not found');
    $('#tTo').textContent = data.to || 'someone';
    $('#tSent').textContent = fmtWhen(new Date(data.createdAt));
    const openAt = data.openAt ? new Date(data.openAt) : null;
    $('#tOpens').textContent = openAt ? fmtWhen(openAt) : 'right away';
    if (data.openedAt) {
      stamp.textContent = 'OPENED';
      stamp.className = 'stamp opened';
      $('#tWhen').textContent = fmtWhen(new Date(data.openedAt));
    } else if (openAt && openAt > new Date()) {
      stamp.textContent = 'SEALED';
      $('#tWhen').textContent = `they can open it from ${fmtWhen(openAt)}`;
    } else {
      stamp.textContent = 'NOT OPENED YET';
      $('#tWhen').textContent = "we'll stamp it the moment they open it";
    }
    // Remember it on this device too, so it shows up under "sent packages".
    const list = loadSent();
    if (!list.some((s) => s.id === id)) saveSent([{ id, token, to: data.to, createdAt: data.createdAt, openAt: data.openAt }, ...list]);
  } catch (e) {
    console.error(e);
    stamp.textContent = 'NOT FOUND';
    $('#tWhen').textContent = 'check that you copied the whole tracking link';
  }
}

// ---------- boot ----------
async function boot() {
  paintBarcodes();
  const dlg = $('#dlg');
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => {
    if (dlg.open) return; // close event arrives a tick late; the dialog may already show the next item
    dlg.querySelectorAll('video, audio, iframe').forEach((m) => m.remove());
    activeWidgets.forEach((w) => w.stop());
    activeWidgets = [];
  });

  const params = new URLSearchParams(location.search);
  if (params.get('track')) return showTracker(params.get('track'));
  const id = params.get('p');
  const hash = location.hash.startsWith('#d=') ? location.hash.slice(3) : null;

  if (!id && !hash) return initEditor();

  document.body.className = 'mode-view';
  $('#viewer').hidden = false;
  $('#tap').textContent = 'fetching your package…';
  $('#parcel').disabled = true;
  try {
    let pkg;
    if (hash) pkg = b64decode(hash);
    else {
      pkg = await fetchPackage(id);
    }
    showViewer(pkg);
  } catch (e) {
    console.error(e);
    $('#tap').textContent = 'this one got lost in the post. we blame the pigeons.';
    $('#vback').textContent = 'Make your own';
  }
}

addEventListener('hashchange', () => location.reload());
boot();
