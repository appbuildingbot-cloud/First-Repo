export interface HtmlExample {
  id: string;
  title: string;
  keywords: string[];
  html: string;
}

const wrap = (body: string, style = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font-family:Inter,system-ui,sans-serif;background:#fff;color:#0f172a}${style}
  </style></head><body>${body}</body></html>`;

export const HTML_EXAMPLES: HtmlExample[] = [
  {
    id: 'cat',
    title: 'A cartoon cat',
    keywords: ['cat', 'kitten', 'feline', 'animal'],
    html: wrap(
      `<div style="min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#fde68a,#fca5a5)">
  <div style="position:relative;width:320px;height:320px">
    <div style="position:absolute;top:30px;left:40px;width:70px;height:70px;background:#fbbf24;border-radius:50% 50% 0 0;transform:rotate(-25deg)"></div>
    <div style="position:absolute;top:30px;right:40px;width:70px;height:70px;background:#fbbf24;border-radius:50% 50% 0 0;transform:rotate(25deg)"></div>
    <div style="position:absolute;top:60px;left:30px;width:260px;height:230px;background:#fbbf24;border-radius:50%"></div>
    <div style="position:absolute;top:140px;left:110px;width:18px;height:24px;background:#0f172a;border-radius:50%"></div>
    <div style="position:absolute;top:140px;left:190px;width:18px;height:24px;background:#0f172a;border-radius:50%"></div>
    <div style="position:absolute;top:180px;left:150px;width:14px;height:10px;background:#fb7185;border-radius:50%"></div>
    <div style="position:absolute;top:195px;left:140px;width:6px;height:14px;background:#0f172a;border-radius:50%;transform:rotate(20deg)"></div>
    <div style="position:absolute;top:195px;left:175px;width:6px;height:14px;background:#0f172a;border-radius:50%;transform:rotate(-20deg)"></div>
    <div style="position:absolute;top:200px;left:80px;width:30px;height:6px;background:rgba(0,0,0,.08);border-radius:999px"></div>
    <div style="position:absolute;top:200px;right:80px;width:30px;height:6px;background:rgba(0,0,0,.08);border-radius:999px"></div>
  </div>
</div>`,
    ),
  },
  {
    id: 'button',
    title: 'A gradient button',
    keywords: ['button', 'cta', 'click', 'call to action'],
    html: wrap(
      `<div style="min-height:100vh;display:grid;place-items:center;background:#0f172a">
  <button style="padding:18px 42px;border:0;border-radius:999px;background:linear-gradient(135deg,#06b6d4,#10b981);color:#04121a;font-weight:700;font-size:18px;cursor:pointer;box-shadow:0 12px 30px rgba(34,211,238,.4)">Get started today</button>
</div>`,
    ),
  },
  {
    id: 'hero',
    title: 'A landing hero section',
    keywords: ['hero', 'landing', 'page', 'heading'],
    html: wrap(
      `<div style="min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#06b6d4,#10b981);font-family:Inter,sans-serif">
  <div style="background:#fff;padding:48px 56px;border-radius:24px;box-shadow:0 20px 60px rgba(0,0,0,.15);text-align:center;max-width:520px">
    <h1 style="margin:0 0 12px;color:#0f172a;font-size:42px">Hello, world</h1>
    <p style="margin:0;color:#64748b;font-size:18px">Build something beautiful today.</p>
    <button style="margin-top:24px;padding:12px 28px;border:0;border-radius:999px;background:linear-gradient(135deg,#06b6d4,#10b981);color:#04121a;font-weight:600;font-size:16px;cursor:pointer">Get started</button>
  </div>
</div>`,
    ),
  },
  {
    id: 'card',
    title: 'A product card',
    keywords: ['card', 'product', 'item', 'shop'],
    html: wrap(
      `<div style="min-height:100vh;display:grid;place-items:center;background:#f1f5f9;padding:40px">
  <div style="width:280px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.1)">
    <div style="height:160px;background:linear-gradient(135deg,#06b6d4,#3b82f6)"></div>
    <div style="padding:20px">
      <h3 style="margin:0 0 6px;font-size:18px">Product Name</h3>
      <p style="margin:0 0 14px;color:#64748b;font-size:13px">A short description of this lovely product.</p>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;font-size:18px;color:#0f172a">$29</span>
        <button style="padding:8px 16px;border:0;border-radius:999px;background:#10b981;color:#04121a;font-weight:600;cursor:pointer">Buy</button>
      </div>
    </div>
  </div>
</div>`,
    ),
  },
  {
    id: 'form',
    title: 'A signup form',
    keywords: ['form', 'signup', 'login', 'input', 'register'],
    html: wrap(
      `<div style="min-height:100vh;display:grid;place-items:center;background:#0f172a;padding:24px">
  <form style="width:320px;background:#1e293b;padding:28px;border-radius:18px;color:#e2e8f0">
    <h2 style="margin:0 0 20px;font-size:22px;text-align:center">Create account</h2>
    <input placeholder="Email" style="width:100%;padding:12px 14px;margin-bottom:12px;border:1px solid #334155;border-radius:10px;background:#0f172a;color:#e2e8f0;font-size:14px;box-sizing:border-box"/>
    <input placeholder="Password" type="password" style="width:100%;padding:12px 14px;margin-bottom:18px;border:1px solid #334155;border-radius:10px;background:#0f172a;color:#e2e8f0;font-size:14px;box-sizing:border-box"/>
    <button style="width:100%;padding:12px;border:0;border-radius:10px;background:linear-gradient(135deg,#06b6d4,#10b981);color:#04121a;font-weight:600;cursor:pointer">Sign up</button>
  </form>
</div>`,
    ),
  },
  {
    id: 'dog',
    title: 'A cartoon dog',
    keywords: ['dog', 'puppy', 'canine', 'pet'],
    html: wrap(
      `<div style="min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#bfdbfe,#a7f3d0)">
  <div style="position:relative;width:300px;height:300px">
    <div style="position:absolute;top:50px;left:40px;width:240px;height:200px;background:#d4a373;border-radius:50%"></div>
    <div style="position:absolute;top:20px;left:60px;width:80px;height:90px;background:#d4a373;border-radius:50% 50% 30% 30%"></div>
    <div style="position:absolute;top:20px;right:60px;width:80px;height:90px;background:#d4a373;border-radius:50% 50% 30% 30%"></div>
    <div style="position:absolute;top:120px;left:120px;width:14px;height:14px;background:#0f172a;border-radius:50%"></div>
    <div style="position:absolute;top:120px;right:120px;width:14px;height:14px;background:#0f172a;border-radius:50%"></div>
    <div style="position:absolute;top:160px;left:140px;width:24px;height:18px;background:#0f172a;border-radius:50%"></div>
    <div style="position:absolute;top:178px;left:148px;width:10px;height:14px;background:#ec4899;border-radius:50%"></div>
  </div>
</div>`,
    ),
  },
  {
    id: 'star',
    title: 'A glowing star',
    keywords: ['star', 'space', 'glow', 'night'],
    html: wrap(
      `<div style="min-height:100vh;display:grid;place-items:center;background:#0a0f1c">
  <div style="font-size:160px;color:#fbbf24;text-shadow:0 0 40px rgba(251,191,36,.7)">★</div>
</div>`,
    ),
  },
  {
    id: 'chart',
    title: 'A bar chart',
    keywords: ['chart', 'bar', 'graph', 'data', 'stats'],
    html: wrap(
      `<div style="min-height:100vh;display:grid;place-items:center;background:#f8fafc;padding:40px">
  <div style="background:#fff;padding:32px;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.08)">
    <h3 style="margin:0 0 20px;font-size:18px">Monthly sales</h3>
    <div style="display:flex;align-items:flex-end;gap:14px;height:200px">
      <div style="width:40px;height:120px;background:#06b6d4;border-radius:6px 6px 0 0"></div>
      <div style="width:40px;height:160px;background:#10b981;border-radius:6px 6px 0 0"></div>
      <div style="width:40px;height:90px;background:#f59e0b;border-radius:6px 6px 0 0"></div>
      <div style="width:40px;height:180px;background:#ec4899;border-radius:6px 6px 0 0"></div>
      <div style="width:40px;height:140px;background:#8b5cf6;border-radius:6px 6px 0 0"></div>
    </div>
  </div>
</div>`,
    ),
  },
  {
    id: 'landscape',
    title: 'A simple landscape',
    keywords: ['landscape', 'mountain', 'sky', 'sun', 'scene', 'nature'],
    html: wrap(
      `<div style="min-height:100vh;background:linear-gradient(180deg,#7dd3fc 0%,#bae6fd 40%,#fde68a 70%,#a7f3d0 100%);position:relative;overflow:hidden">
  <div style="position:absolute;top:40px;right:60px;width:80px;height:80px;background:#fef3c7;border-radius:50%;box-shadow:0 0 50px rgba(254,243,199,.8)"></div>
  <div style="position:absolute;bottom:140px;left:0;right:0;height:120px;background:#475569;clip-path:polygon(0 100%,20% 30%,40% 70%,60% 10%,80% 60%,100% 100%)"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:140px;background:#16a34a"></div>
</div>`,
    ),
  },
];

export function findExamples(query: string, limit = 4): HtmlExample[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = HTML_EXAMPLES.map(ex => {
    let score = 0;
    for (const k of ex.keywords) if (q.includes(k)) score += 2;
    if (ex.title.toLowerCase().includes(q)) score += 1;
    return { ex, score };
  });
  const matches = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  if (matches.length) return matches.slice(0, limit).map(s => s.ex);
  // If user wrote "html for X" with no keyword hit, return a few starters
  return HTML_EXAMPLES.slice(0, limit);
}
