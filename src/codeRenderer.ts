import type { FormatInfo } from './formats';

export type CodeMode = 'html' | 'css' | 'svg' | 'json' | 'markdown' | 'canvas' | 'turtle';

export interface RenderResult {
  blob: Blob;
  fileName: string;
  size: number;
  /** PNG data URL (base64) — used for inline previews + history thumbnails */
  dataUrl: string;
}

export class RenderError extends Error {}

const CODE_MODES: { id: CodeMode; label: string; hint: string }[] = [
  { id: 'html', label: 'HTML', hint: 'Full HTML page — rendered as it looks in a browser' },
  { id: 'css', label: 'CSS', hint: 'Stylesheet applied to a live demo document' },
  { id: 'svg', label: 'SVG', hint: 'Vector markup drawn as a real image' },
  { id: 'markdown', label: 'Markdown', hint: 'MD rendered into styled HTML' },
  { id: 'json', label: 'JSON', hint: 'Structured tree visualization' },
  { id: 'canvas', label: 'Canvas JS', hint: 'JavaScript that draws on a 2D canvas' },
  { id: 'turtle', label: 'Turtle', hint: 'Python-style turtle graphics (forward/right/color...)' },
];

export const CODE_MODE_OPTIONS = CODE_MODES;

export function detectMode(code: string, ext?: string): CodeMode {
  const upper = (ext ?? '').toUpperCase();
  if (upper === 'HTML' || upper === 'HTM' || /<html|<!doctype html/i.test(code)) return 'html';
  if (upper === 'CSS' || upper === 'SCSS') return 'css';
  if (upper === 'SVG' || /<svg[\s>]/i.test(code)) return 'svg';
  if (upper === 'MD' || upper === 'MARKDOWN') return 'markdown';
  if (upper === 'JSON') return 'json';
  if (upper === 'PY' || /\b(forward|right|left|pendown|penup|turtle)\b/i.test(code)) return 'turtle';
  if (upper === 'JS' || upper === 'TS' || upper === 'JSX' || upper === 'TSX') return 'canvas';
  return 'html';
}

function setExt(name: string, ext: string): string {
  const idx = name.lastIndexOf('.');
  const base = idx > 0 ? name.slice(0, idx) : name;
  return `${base}.${ext.toLowerCase()}`;
}

function canvasBlob(canvas: HTMLCanvasElement, mime = 'image/png', quality = 0.95): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new RenderError('Rendering produced no image.'))),
      mime,
      quality,
    );
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

function makeCanvas(width: number, height: number, bg = '#0b1220'): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  return [canvas, ctx];
}

/** Load an Image element from an SVG/HTML string, returning a canvas-drawn image. */
async function svgImageToCanvas(svg: string, width: number, height: number, bg = '#ffffff'): Promise<HTMLCanvasElement> {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new RenderError('Could not render the markup to an image.'));
      img.src = url;
    });
    const [canvas, ctx] = makeCanvas(width, height, bg);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Build a complete HTML document from code, wrapping fragments in a styled body. */
function wrapHtml(code: string): string {
  if (/<html[\s>]/i.test(code) || /<!doctype html/i.test(code)) return code;
  // fragment: wrap so it still renders fully
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font-family:Inter,system-ui,sans-serif;background:#fff;color:#0f172a}
  </style></head><body>${code}</body></html>`;
}

/** Render HTML by painting it in a live iframe, then snapshot via foreignObject SVG. */
async function renderHtmlToCanvas(code: string, width = 1280, height = 800): Promise<HTMLCanvasElement> {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;border:0;background:#fff;`;
  iframe.setAttribute('sandbox', 'allow-same-origin');
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(wrapHtml(code));
    doc.close();
    // Let layout, fonts, and images settle
    await new Promise(r => setTimeout(r, 250));
    await Promise.all(
      Array.from(doc.images).map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>(res => { img.onload = img.onerror = () => res(); }),
      ),
    );
    const html = new XMLSerializer().serializeToString(doc.documentElement);
    // foreignObject needs an XHTML namespace; wrap properly
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject width="100%" height="100%">` +
      html
        .replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
      + `</foreignObject></svg>`;
    return await svgImageToCanvas(svg, width, height, '#ffffff');
  } finally {
    iframe.remove();
  }
}

function mdToStyledHtml(md: string): string {
  let html = md
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
    .replace(/^[-*] (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Inter,sans-serif;padding:56px;color:#0f172a;background:#fff;max-width:720px;margin:0 auto;line-height:1.6}
    h1{font-size:44px;color:#0ea5e9;margin:0 0 12px}h2{font-size:30px;color:#0891b2}h3{font-size:22px;color:#06b6d4}
    code{background:#e0f2fe;padding:2px 6px;border-radius:4px;font-family:ui-monospace,monospace;color:#0e7490}
    blockquote{border-left:4px solid #22d3ee;margin:0;padding:8px 16px;background:#f0f9ff;color:#334155}
    a{color:#0ea5e9}ul{padding-left:24px}li{margin:6px 0}
  </style></head><body>${html}</body></html>`;
}

function jsonToTreeCanvas(code: string): HTMLCanvasElement {
  let data: unknown;
  try { data = JSON.parse(code); } catch { throw new RenderError('Invalid JSON.'); }
  const width = 1000;
  const height = 700;
  const [canvas, ctx] = makeCanvas(width, height, '#0f172a');
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px ui-monospace, monospace';
  const lines: { text: string; type: string }[] = [];
  const walk = (v: unknown, key: string, depth: number) => {
    if (depth > 6) { lines.push({ text: `${'  '.repeat(depth)}${key}: …`, type: 'dim' }); return; }
    if (Array.isArray(v)) {
      lines.push({ text: `${'  '.repeat(depth)}${key}: [`, type: 'arr' });
      v.forEach((item, i) => walk(item, `[${i}]`, depth + 1));
      lines.push({ text: `${'  '.repeat(depth)}]`, type: 'arr' });
    } else if (v && typeof v === 'object') {
      lines.push({ text: `${'  '.repeat(depth)}${key}: {`, type: 'obj' });
      Object.entries(v as Record<string, unknown>).forEach(([k, val]) => walk(val, k, depth + 1));
      lines.push({ text: `${'  '.repeat(depth)}}`, type: 'obj' });
    } else {
      const t = typeof v;
      lines.push({ text: `${'  '.repeat(depth)}${key}: ${JSON.stringify(v)}`, type: t });
    }
  };
  walk(data, 'root', 0);
  const colors: Record<string, string> = { arr: '#22d3ee', obj: '#a78bfa', string: '#10b981', number: '#f59e0b', boolean: '#ec4899', dim: '#64748b' };
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('JSON structure', 24, 30);
  ctx.font = '14px ui-monospace, monospace';
  lines.slice(0, 38).forEach((l, i) => {
    ctx.fillStyle = colors[l.type] || '#e2e8f0';
    ctx.fillText(l.text.slice(0, 95), 24, 60 + i * 17);
  });
  return canvas;
}

function interpretTurtle(code: string): HTMLCanvasElement {
  const width = 800;
  const height = 600;
  const [canvas, ctx] = makeCanvas(width, height, '#0f172a');
  let x = width / 2;
  let y = height / 2;
  let angle = -90;
  let penDown = true;
  let color = '#22d3ee';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (const raw of code.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const m = line.match(/^(\w+)\s*\(([^)]*)\)/);
    if (!m) continue;
    const [, cmd, argsRaw] = m;
    const args = argsRaw.split(',').map(a => a.trim().replace(/['"]/g, ''));
    const n = Number(args[0]);
    switch (cmd.toLowerCase()) {
      case 'forward': case 'fd': {
        const nx = x + n * Math.cos((angle * Math.PI) / 180);
        const ny = y + n * Math.sin((angle * Math.PI) / 180);
        if (penDown) { ctx.lineTo(nx, ny); ctx.stroke(); ctx.beginPath(); ctx.moveTo(nx, ny); }
        x = nx; y = ny; break;
      }
      case 'backward': case 'bk': {
        const nx = x - n * Math.cos((angle * Math.PI) / 180);
        const ny = y - n * Math.sin((angle * Math.PI) / 180);
        if (penDown) { ctx.lineTo(nx, ny); ctx.stroke(); ctx.beginPath(); ctx.moveTo(nx, ny); }
        x = nx; y = ny; break;
      }
      case 'right': case 'rt': angle += n; break;
      case 'left': case 'lt': angle -= n; break;
      case 'color': case 'pencolor':
        color = args[0] || color; ctx.strokeStyle = color; break;
      case 'pensize': case 'width':
        ctx.lineWidth = Number(args[0]) || 2; break;
      case 'penup': case 'pu': penDown = false; break;
      case 'pendown': case 'pd': penDown = true; ctx.beginPath(); ctx.moveTo(x, y); break;
      case 'goto': x = Number(args[0]); y = Number(args[1]); ctx.beginPath(); ctx.moveTo(x, y); break;
      case 'fill': ctx.fillStyle = args[0] || color; break;
      case 'end_fill': ctx.fill(); break;
      case 'circle': {
        const r = Math.abs(n);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (penDown) ctx.stroke();
        if (ctx.fillStyle && ctx.fillStyle !== '#0b1220') ctx.fill();
        break;
      }
    }
  }
  ctx.stroke();
  return canvas;
}

function runCanvasJs(code: string): HTMLCanvasElement {
  const width = 800;
  const height = 600;
  const [canvas, ctx] = makeCanvas(width, height, '#0f172a');
  const api = new Proxy(ctx, {
    get(t, p) {
      if (typeof p === 'symbol') return undefined;
      const v = (t as unknown as Record<string, unknown>)[p];
      if (typeof v === 'function') return (...args: unknown[]) => v.apply(t, args as never);
      return v;
    },
  });
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('canvas', 'ctx', 'width', 'height', code);
    fn(canvas, api, width, height);
  } catch (err) {
    ctx.fillStyle = '#f8fafc';
    ctx.font = '15px Inter, sans-serif';
    ctx.fillText(`Runtime error: ${(err as Error).message}`, 20, 30);
  }
  return canvas;
}

async function renderCssToCanvas(code: string): Promise<HTMLCanvasElement> {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${code}</style></head>
  <body style="margin:0;padding:48px;font-family:Inter,sans-serif;background:#fff;color:#0f172a">
    <h1>Styled Heading</h1>
    <p>A paragraph of demo text styled by your CSS.</p>
    <button>Button</button>
    <div style="display:flex;gap:16px;margin-top:24px">
      <div class="card-demo" style="width:120px;height:120px;display:grid;place-items:center">Card A</div>
      <div class="card-demo" style="width:120px;height:120px;display:grid;place-items:center">Card B</div>
      <div class="card-demo" style="width:120px;height:120px;display:grid;place-items:center">Card C</div>
    </div>
  </body></html>`;
  return renderHtmlToCanvas(html, 1200, 700);
}

/** Render arbitrary code (string + mode) into a canvas. */
export async function renderCodeCanvas(code: string, mode: CodeMode): Promise<HTMLCanvasElement> {
  switch (mode) {
    case 'html': return renderHtmlToCanvas(code, 1280, 800);
    case 'css': return renderCssToCanvas(code);
    case 'svg': {
      const wrapped = /<svg[\s>]/i.test(code)
        ? code
        : `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">${code}</svg>`;
      return svgImageToCanvas(wrapped, 800, 600, '#ffffff');
    }
    case 'markdown': return renderHtmlToCanvas(mdToStyledHtml(code), 900, 800);
    case 'json': return jsonToTreeCanvas(code);
    case 'canvas': return runCanvasJs(code);
    case 'turtle': return interpretTurtle(code);
    default: return renderHtmlToCanvas(code);
  }
}

/** Produce a downsized thumbnail data URL from a full-size canvas. */
export function makeThumbnail(canvas: HTMLCanvasElement, max = 220): string {
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const t = document.createElement('canvas');
  t.width = w;
  t.height = h;
  const tctx = t.getContext('2d')!;
  tctx.drawImage(canvas, 0, 0, w, h);
  try { return t.toDataURL('image/png'); } catch { return ''; }
}

export async function renderCodeToImage(
  file: File,
  source: FormatInfo,
  target: FormatInfo,
): Promise<RenderResult> {
  const code = await file.text();
  const mode = detectMode(code, source.ext);
  const canvas = await renderCodeCanvas(code, mode);
  const blob = await canvasBlob(canvas, target.mime === 'image/png' ? 'image/png' : 'image/png');
  return { blob, fileName: setExt(file.name, target.ext), size: blob.size, dataUrl: canvasToDataUrl(canvas) };
}
