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

  gift: `<svg viewBox="0 0 100 100" aria-hidden="true">
    <g transform="rotate(-4 50 55)">
      <rect x="20" y="44" width="60" height="44" rx="3" fill="#e98fa3"/>
      <rect x="20" y="44" width="60" height="44" rx="3" fill="url(#g-gift)" opacity=".25"/>
      <rect x="15" y="34" width="70" height="14" rx="3" fill="#f2a4b5"/>
      <rect x="44" y="34" width="12" height="54" fill="#fbe3b8"/>
      <path d="M50 34c-6-12-22-16-24-8s14 10 24 8zM50 34c6-12 22-16 24-8s-14 10-24 8z" fill="#fbe3b8" stroke="#e6c48e" stroke-width="1.4"/>
      <circle cx="50" cy="33" r="4.5" fill="#f6d39b"/>
      <path d="M20 66h60" stroke="#d97a90" stroke-width="1.2" stroke-dasharray="2 3"/>
    </g>
    <defs><linearGradient id="g-gift" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#b4546c"/></linearGradient></defs>
  </svg>`,

  voice: `<svg viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="g-mic" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa3ab"/><stop offset=".45" stop-color="#eef1f3"/><stop offset="1" stop-color="#8c959d"/></linearGradient></defs>
    <g transform="rotate(8 50 50)">
      <rect x="35" y="10" width="30" height="44" rx="15" fill="url(#g-mic)" stroke="#6f7880" stroke-width="1.5"/>
      <path d="M38 22h24M37 30h26M37 38h26M38 46h24" stroke="#6f7880" stroke-width="1.2"/>
      <rect x="35" y="27" width="30" height="5" fill="#c8372f"/>
      <path d="M28 40v4c0 12 10 21 22 21s22-9 22-21v-4" fill="none" stroke="#3a3a3f" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M50 65v16" stroke="#3a3a3f" stroke-width="4"/>
      <rect x="34" y="80" width="32" height="7" rx="3.5" fill="#3a3a3f"/>
    </g>
  </svg>`,

  drawing: `<svg viewBox="0 0 110 100" aria-hidden="true">
    <path d="M14 56c0-24 22-40 46-38s38 16 38 32c0 10-8 14-16 12s-12 6-6 12-4 14-20 14C30 88 14 76 14 56z" fill="#ead2a8" stroke="#c9a46d" stroke-width="1.5" transform="rotate(-6 55 55)"/>
    <ellipse cx="78" cy="60" rx="6" ry="5" fill="#efe5d6" transform="rotate(-6 55 55)"/>
    <circle cx="32" cy="46" r="7" fill="#c8372f"/>
    <circle cx="48" cy="33" r="7" fill="#e0a526"/>
    <circle cx="67" cy="32" r="7" fill="#3f8a55"/>
    <circle cx="28" cy="66" r="7" fill="#2f6db5"/>
    <circle cx="46" cy="74" r="6.5" fill="#e27aa0"/>
    <g transform="rotate(38 70 60)">
      <rect x="66" y="22" width="7" height="50" rx="3" fill="#b07b45"/>
      <rect x="66" y="70" width="7" height="8" fill="#c9cdd1"/>
      <path d="M66 78h7l-1 9c-1 4-4 4-5 0z" fill="#2b211b"/>
    </g>
  </svg>`,

  location: `<svg viewBox="0 0 110 100" aria-hidden="true">
    <path d="M10 40 38 30l34 10 28-10v50L72 90 38 80 10 90z" fill="#e8e1cc"/>
    <path d="M38 30v50M72 40v50" stroke="#cfc4a6" stroke-width="1.5"/>
    <path d="M10 40 38 30v50L10 90z" fill="#ddd4b9"/>
    <path d="M72 40l28-10v50L72 90z" fill="#ddd4b9"/>
    <path d="M14 70c14-6 20 4 34-2s22-14 36-8 12 2 14 0" fill="none" stroke="#88b6d6" stroke-width="3" stroke-linecap="round"/>
    <path d="M20 52h12M50 56h10M80 62h12" stroke="#b9ae8e" stroke-width="1.5" stroke-dasharray="3 3"/>
    <path d="M10 40 38 30l34 10 28-10v50L72 90 38 80 10 90z" fill="none" stroke="#b5a885" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="56" cy="64" rx="7" ry="2.5" fill="rgba(0,0,0,.18)"/>
    <path d="M56 64c-9-12-14-19-14-26a14 14 0 0 1 28 0c0 7-5 14-14 26z" fill="#c8372f"/>
    <circle cx="56" cy="38" r="5" fill="#fff4ea"/>
  </svg>`,

  news: `<svg viewBox="0 0 110 100" aria-hidden="true">
    <g transform="rotate(-5 55 50)">
      <path d="M20 16h72v70H28a8 8 0 0 1-8-8z" fill="#f4f0e6" stroke="#cfc8b8" stroke-width="1.2"/>
      <path d="M12 30h8v48a4 4 0 0 1-8 0z" fill="#e5dfd0" stroke="#cfc8b8" stroke-width="1.2"/>
      <rect x="28" y="22" width="56" height="9" fill="#2b2b2b"/>
      <path d="M28 36h56" stroke="#2b2b2b" stroke-width="1"/>
      <rect x="28" y="41" width="24" height="18" fill="#b9b3a6"/>
      <path d="M56 42h28M56 47h28M56 52h24M56 57h28M28 64h56M28 69h56M28 74h48M28 79h52" stroke="#9a948a" stroke-width="2"/>
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
