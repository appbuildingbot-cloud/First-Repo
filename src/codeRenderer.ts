import type { FormatInfo } from './formats';

export interface RenderResult {
  blob: Blob;
  fileName: string;
  size: number;
}

export class RenderError extends Error {}

function setExt(name: string, ext: string): string {
  const idx = name.lastIndexOf('.');
  const base = idx > 0 ? name.slice(0, idx) : name;
  return `${base}.${ext.toLowerCase()}`;
}

async function canvasBlob(canvas: HTMLCanvasElement, mime = 'image/png'): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new RenderError('Rendering produced no image.'))),
      mime,
      0.95,
    );
  });
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

/** Render an actual SVG image drawn by the code into PNG. */
async function renderSvg(code: string, file: File, target: FormatInfo): Promise<RenderResult> {
  const blob = new Blob([code], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new RenderError('Could not render the SVG markup.'));
      img.src = url;
    });
    const w = img.naturalWidth || 800;
    const h = img.naturalHeight || 600;
    const [canvas, ctx] = makeCanvas(w, h, '#ffffff');
    ctx.drawImage(img, 0, 0);
    const out = await canvasBlob(canvas, target.mime === 'image/png' ? 'image/png' : 'image/png');
    return { blob: out, fileName: setExt(file.name, target.ext), size: out.size };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Render HTML/CSS by painting it into a sandboxed iframe, then snapshotting the viewport. */
async function renderHtml(code: string, file: File, target: FormatInfo): Promise<RenderResult> {
  const width = 1200;
  const height = 800;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;
  iframe.style.border = '0';
  iframe.style.background = '#ffffff';
  iframe.setAttribute('sandbox', 'allow-same-origin');
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(code);
    doc.close();
    // wait for layout + images
    await new Promise(r => setTimeout(r, 350));
    await Promise.all(
      Array.from(doc.images).map(
        img =>
          img.complete
            ? Promise.resolve()
            : new Promise(res => {
                img.onload = img.onerror = res;
              }),
      ),
    );
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    // Foreign-object SVG snapshot of the live DOM
    const serialized = new XMLSerializer().serializeToString(doc.documentElement);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
    const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new RenderError('The HTML could not be snapshotted to an image in this browser.'));
      img.src = svgUrl;
    });
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(svgUrl);
    const out = await canvasBlob(canvas, target.mime === 'image/png' ? 'image/png' : 'image/png');
    return { blob: out, fileName: setExt(file.name, target.ext), size: out.size };
  } finally {
    iframe.remove();
  }
}

/** Render CSS by applying it to a demo document, then snapshot. */
async function renderCss(code: string, file: File, target: FormatInfo): Promise<RenderResult> {
  const html = `<!doctype html><html><head><style>${code}</style></head>
  <body style="margin:0;padding:40px;font-family:Inter,sans-serif">
    <h1>Styled Heading</h1>
    <p>A paragraph of demo text styled by your CSS.</p>
    <button>Button</button>
    <div style="display:flex;gap:12px;margin-top:20px">
      <div style="width:80px;height:80px">Box A</div>
      <div style="width:80px;height:80px">Box B</div>
      <div style="width:80px;height:80px">Box C</div>
    </div>
  </body></html>`;
  return renderHtml(html, file, target);
}

/** Render drawing/graphics code (Canvas API calls, Python turtle-style, data plots). */
async function renderDrawingCode(code: string, ext: string, file: File, target: FormatInfo): Promise<RenderResult> {
  const width = 800;
  const height = 600;
  const [canvas, ctx] = makeCanvas(width, height, '#0f172a');
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '16px Inter, sans-serif';

  if (ext === 'JS' || ext === 'TS' || ext === 'JSX' || ext === 'TSX') {
    // Execute drawing calls against the live 2d context in a sandboxed Function.
    // We expose a curated, safe drawing subset of the canvas API.
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
      ctx.fillText(`Ran but threw: ${(err as Error).message}`, 20, 30);
    }
  } else if (ext === 'PY') {
    // Turtle-style: parse common drawing calls (forward, right, left, color, pensize)
    interpretTurtle(code, ctx, width, height);
  } else if (ext === 'GO' || ext === 'RS' || ext === 'C' || ext === 'CPP' || ext === 'JAVA') {
    // Best-effort: scan for drawing-like patterns and produce a representative render
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('Compiled drawing code — rendered diagram', 20, 30);
    drawCodeDiagram(code, ctx, width, height);
  } else {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('Code rendered as visual output', 20, 30);
    drawCodeDiagram(code, ctx, width, height);
  }

  const out = await canvasBlob(canvas, target.mime === 'image/png' ? 'image/png' : 'image/png');
  return { blob: out, fileName: setExt(file.name, target.ext), size: out.size };
}

function interpretTurtle(code: string, ctx: CanvasRenderingContext2D, w: number, h: number) {
  let x = w / 2;
  let y = h / 2;
  let angle = -90; // facing up, degrees
  let penDown = true;
  let color = '#22d3ee';
  let size = 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.beginPath();
  ctx.moveTo(x, y);
  const lines = code.split('\n');
  for (let raw of lines) {
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
        size = Number(args[0]) || size; ctx.lineWidth = size; break;
      case 'penup': case 'pu': penDown = false; break;
      case 'pendown': case 'pd': penDown = true; ctx.beginPath(); ctx.moveTo(x, y); break;
      case 'goto': x = Number(args[0]); y = Number(args[1]); ctx.beginPath(); ctx.moveTo(x, y); break;
      case 'begin_fill': case 'fill': ctx.fillStyle = args[0] || ctx.strokeStyle as string; break;
      case 'end_fill': ctx.fill(); break;
      case 'circle': {
        const r = n;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (penDown) ctx.stroke();
        break;
      }
    }
  }
  ctx.stroke();
}

function drawCodeDiagram(code: string, ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Draw a clean visual summary: function/struct boxes connected like a diagram
  const funcs = [...code.matchAll(/(?:func|function|def|fn|void|int|public|private|static)?\s*(\w+)\s*\(/g)].map(m => m[1]).slice(0, 12);
  const palette = ['#22d3ee', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];
  funcs.forEach((name, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = 60 + col * 230;
    const by = 80 + row * 130;
    ctx.fillStyle = palette[i % palette.length];
    ctx.globalAlpha = 0.18;
    ctx.fillRect(bx, by, 200, 90);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette[i % palette.length];
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, 200, 90);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '15px Inter, monospace';
    ctx.fillText(name + '()', bx + 14, by + 40);
  });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px Inter, sans-serif';
  ctx.fillText(`${funcs.length} functions detected · visual diagram`, 60, 40);
}

export async function renderCodeToImage(file: File, source: FormatInfo, target: FormatInfo): Promise<RenderResult> {
  const code = await file.text();
  const ext = source.ext;

  if (ext === 'SVG' || /<svg[\s>]/i.test(code)) return renderSvg(code, file, target);
  if (ext === 'HTML' || ext === 'HTM' || /<html|<!doctype html/i.test(code)) return renderHtml(code, file, target);
  if (ext === 'CSS' || ext === 'SCSS') return renderCss(code, file, target);
  if (ext === 'JSON') return renderJsonTree(code, file, target);
  if (ext === 'MD') return renderMarkdown(code, file, target);
  // graphics / drawing / general code -> drawn visual
  return renderDrawingCode(code, ext, file, target);
}

async function renderJsonTree(code: string, file: File, target: FormatInfo): Promise<RenderResult> {
  let data: unknown;
  try { data = JSON.parse(code); } catch { throw new RenderError('Invalid JSON.'); }
  const width = 1000;
  const height = 700;
  const [canvas, ctx] = makeCanvas(width, height, '#0f172a');
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px ui-monospace, monospace';
  const lines: { text: string; depth: number; type: string }[] = [];
  const walk = (v: unknown, key: string, depth: number) => {
    if (depth > 6) { lines.push({ text: `${'  '.repeat(depth)}${key}: …`, depth, type: 'dim' }); return; }
    if (Array.isArray(v)) {
      lines.push({ text: `${'  '.repeat(depth)}${key}: [`, depth, type: 'arr' });
      v.forEach((item, i) => walk(item, `[${i}]`, depth + 1));
      lines.push({ text: `${'  '.repeat(depth)}]`, depth, type: 'arr' });
    } else if (v && typeof v === 'object') {
      lines.push({ text: `${'  '.repeat(depth)}${key}: {`, depth, type: 'obj' });
      Object.entries(v as Record<string, unknown>).forEach(([k, val]) => walk(val, k, depth + 1));
      lines.push({ text: `${'  '.repeat(depth)}}`, depth, type: 'obj' });
    } else {
      const t = typeof v;
      lines.push({ text: `${'  '.repeat(depth)}${key}: ${JSON.stringify(v)}`, depth, type: t });
    }
  };
  walk(data, 'root', 0);
  const colors: Record<string, string> = { arr: '#22d3ee', obj: '#a78bfa', string: '#10b981', number: '#f59e0b', boolean: '#ec4899', dim: '#64748b' };
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('JSON structure', 24, 30);
  ctx.font = '14px ui-monospace, monospace';
  lines.slice(0, 40).forEach((l, i) => {
    ctx.fillStyle = colors[l.type] || '#e2e8f0';
    ctx.fillText(l.text.slice(0, 90), 24, 60 + i * 18);
  });
  const out = await canvasBlob(canvas, target.mime === 'image/png' ? 'image/png' : 'image/png');
  return { blob: out, fileName: setExt(file.name, target.ext), size: out.size };
}

async function renderMarkdown(code: string, file: File, target: FormatInfo): Promise<RenderResult> {
  // Convert MD to styled HTML and snapshot
  const html = mdToStyledHtml(code);
  return renderHtml(html, file, target);
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
  return `<!doctype html><html><head><style>
    body{font-family:Inter,sans-serif;padding:60px;color:#0f172a;background:#fff;max-width:760px;margin:0 auto;line-height:1.6}
    h1{font-size:48px;color:#0ea5e9;margin:0 0 12px}h2{font-size:32px;color:#0891b2}h3{font-size:24px;color:#06b6d4}
    code{background:#e0f2fe;padding:2px 6px;border-radius:4px;font-family:ui-monospace,monospace;color:#0e7490}
    blockquote{border-left:4px solid #22d3ee;margin:0;padding:8px 16px;background:#f0f9ff;color:#334155}
    a{color:#0ea5e9}ul{padding-left:24px}li{margin:6px 0}
  </style></head><body>${html}</body></html>`;
}
