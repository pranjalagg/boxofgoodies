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
  coupon: {
    label: 'Coupon',
    fields: [
      { k: 'title', label: 'Good for', ph: 'one free hug', req: true, max: 60 },
      { k: 'details', label: 'Fine print', ph: 'redeemable anytime, no questions asked', max: 160 },
      { k: 'expires', label: 'Expires (optional)', type: 'date' },
    ],
  },
};

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

function summary(it) {
  if (it.type === 'note') return it.text;
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
  if (T.fields.some((f) => f.type === 'file') && !SUPABASE_URL) {
    err.textContent = 'uploads need Supabase set up (see README). links still work.';
  }
  dlg.className = '';
  form.replaceChildren(
    h('button', { type: 'button', className: 'x', ariaLabel: 'Close', onclick: () => dlg.close() }, '×'),
    h('h3', { className: 'dlg-title' }, `${item ? 'EDIT' : 'ADD'} ${T.label.toUpperCase()}`),
    ...T.fields.map((f) => fieldEl(f, item)),
    err,
    h('div', { className: 'row' },
      h('button', { type: 'submit', className: 'btn primary' }, item ? 'Save changes' : 'Add to package'),
      h('button', { type: 'button', className: 'btn', onclick: () => dlg.close() }, 'Cancel')),
  );
  form.onsubmit = (e) => {
    e.preventDefault();
    const data = {};
    let file = null;
    for (const f of T.fields) {
      const el = form.elements[f.k];
      if (f.type === 'file') {
        file = el.files[0] || null;
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
    toast('your package is ready to send');
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

  const unseal = () => {
    clearInterval(sealTimer);
    parcel.classList.remove('sealed');
    parcel.disabled = false;
    skip.hidden = true;
    tap.textContent = 'tap to open';
  };

  parcel.onclick = () => {
    // Still sealed: rattle the box instead of opening it.
    if (parcel.classList.contains('sealed')) {
      parcel.classList.remove('nope');
      void parcel.offsetWidth; // restart the animation
      parcel.classList.add('nope');
      setTimeout(() => parcel.classList.remove('nope'), 450); // back to floating
      toast(`not yet! it opens ${fmtWhen(until)}`);
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
    if (left > 0) { tap.textContent = `opens in ${countdown(left)}`; return; }
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
  dlg.addEventListener('close', () => dlg.querySelectorAll('video, iframe').forEach((m) => m.remove()));

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
    $('#tap').textContent = "hmm, this package got lost in the mail";
    $('#vback').textContent = 'Make your own';
  }
}

addEventListener('hashchange', () => location.reload());
boot();
