// Hand-drawn-ish SVG art for each item type. Trusted static markup.

const typewriterKeys = (() => {
  let s = '';
  [[60, 9, 20], [68, 8, 24], [76, 7, 28]].forEach(([y, n, x0]) => {
    for (let i = 0; i < n; i++) {
      s += `<circle cx="${x0 + i * 10}" cy="${y}" r="3.3" fill="#2d3330" stroke="#e9e6dc" stroke-width="1"/>`;
    }
  });
  return s;
})();

export const ICONS = {
  note: `<svg viewBox="0 0 120 100" aria-hidden="true">
    <rect x="38" y="4" width="44" height="34" fill="#fbfaf5" stroke="#d8d2c4"/>
    <path d="M44 13h30M44 19h26M44 25h30" stroke="#b9b3a6" stroke-width="1.4"/>
    <rect x="14" y="30" width="92" height="11" rx="5.5" fill="#363636"/>
    <rect x="18" y="32" width="84" height="3" rx="1.5" fill="#5a5a5a"/>
    <circle cx="11" cy="35.5" r="5.5" fill="#262626"/><circle cx="109" cy="35.5" r="5.5" fill="#262626"/>
    <path d="M12 43h96l7 40a6 6 0 0 1-6 7H11a6 6 0 0 1-6-7z" fill="#93c3b1"/>
    <path d="M18 47h84l3 6H15z" fill="#7eae9c"/>
    <path d="M12 43h96l1 4H11z" fill="#a9d2c2"/>
    ${typewriterKeys}
    <rect x="40" y="82" width="40" height="5" rx="2.5" fill="#2d3330"/>
  </svg>`,

  photo: `<svg viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4b39a"/><stop offset="1" stop-color="#f6dcb4"/></linearGradient></defs>
    <g transform="rotate(-7 50 50)">
      <rect x="17" y="9" width="66" height="80" rx="2" fill="#fdfcf7" stroke="#ddd6c8"/>
      <rect x="23" y="15" width="54" height="52" fill="url(#g-sky)"/>
      <circle cx="61" cy="32" r="7" fill="#fff4d6"/>
      <path d="M23 67V52l12-12 11 11 9-8 22 19v5z" fill="#6f8f7c"/>
      <path d="M23 67v-7l18-10 14 9 22-6v14z" fill="#4e6e5d"/>
      <path d="M30 78h22" stroke="#9a94a8" stroke-width="1.6" stroke-linecap="round"/>
    </g>
  </svg>`,

  song: `<svg viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <radialGradient id="g-cd" cx=".5" cy=".5" r=".5"><stop offset=".15" stop-color="#e9edf0"/><stop offset=".7" stop-color="#c9d0d6"/><stop offset="1" stop-color="#aeb6be"/></radialGradient>
      <linearGradient id="g-r1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ad5"/><stop offset=".5" stop-color="#9ee8ff"/><stop offset="1" stop-color="#fff59a"/></linearGradient>
      <linearGradient id="g-r2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6ffcb"/><stop offset=".5" stop-color="#c7a6ff"/><stop offset="1" stop-color="#ffb3a6"/></linearGradient>
    </defs>
    <circle cx="50" cy="50" r="42" fill="url(#g-cd)"/>
    <path d="M50 50 L50 8 A42 42 0 0 1 86 29 Z" fill="url(#g-r1)" opacity=".55"/>
    <path d="M50 50 L14 71 A42 42 0 0 1 8 50 Z" fill="url(#g-r2)" opacity=".5"/>
    <path d="M50 50 L92 50 A42 42 0 0 1 79 80 Z" fill="url(#g-r2)" opacity=".35"/>
    <circle cx="50" cy="50" r="42" fill="none" stroke="#9aa3ab" stroke-width=".8"/>
    <circle cx="50" cy="50" r="14" fill="#e3e7ea" stroke="#b8c0c7"/>
    <circle cx="50" cy="50" r="6" fill="#f3ece0" stroke="#a9b1b8"/>
  </svg>`,

  video: `<svg viewBox="0 0 100 100" aria-hidden="true">
    <g transform="rotate(-4 50 50)">
      <rect x="8" y="24" width="84" height="54" rx="3" fill="#1e1e21"/>
      <rect x="8" y="24" width="84" height="5" rx="2" fill="#2e2e33"/>
      <rect x="16" y="31" width="68" height="16" fill="#f3eee2"/>
      <rect x="16" y="31" width="68" height="4" fill="#c9534f"/>
      <path d="M21 41h30" stroke="#5a5048" stroke-width="1.4"/>
      <rect x="28" y="53" width="44" height="17" rx="2" fill="#3a3a40"/>
      <circle cx="39" cy="61.5" r="6.5" fill="#d9d4ca"/><circle cx="61" cy="61.5" r="6.5" fill="#d9d4ca"/>
      <circle cx="39" cy="61.5" r="2.4" fill="#3a3a40"/><circle cx="61" cy="61.5" r="2.4" fill="#3a3a40"/>
      <path d="M45 61.5h10" stroke="#6b5a48" stroke-width="3"/>
    </g>
  </svg>`,

  coupon: `<svg viewBox="0 0 110 100" aria-hidden="true">
    <defs><mask id="m-cp"><rect width="110" height="100" fill="#fff"/><circle cx="6" cy="50" r="6" fill="#000"/><circle cx="104" cy="50" r="6" fill="#000"/></mask></defs>
    <g transform="rotate(-3 55 50)" mask="url(#m-cp)">
      <rect x="6" y="28" width="98" height="44" fill="#dcc48f"/>
      <rect x="11" y="32" width="88" height="36" fill="none" stroke="#6e5428" stroke-width="1" stroke-dasharray="3 2"/>
      <circle cx="27" cy="50" r="11" fill="none" stroke="#4a3618" stroke-width="1.6"/>
      <text x="27" y="54.5" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="12" fill="#4a3618">50</text>
      <text x="68" y="44" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="8" fill="#4a3618">FREE COUPON</text>
      <path d="M46 51h44M50 57h36M54 62h28" stroke="#6e5428" stroke-width="1.4"/>
    </g>
  </svg>`,
};

// Deterministic pseudo-random barcode.
export function barcode(seed = 7) {
  let s = seed * 997;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  let x = 0, rects = '';
  while (x < 196) {
    const w = 1 + Math.floor(r() * 3);
    rects += `<rect x="${x}" width="${w}" height="40"/>`;
    x += w + 1 + Math.floor(r() * 2.4);
  }
  return `<svg viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;
}
