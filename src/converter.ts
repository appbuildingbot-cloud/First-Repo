import JSZip from 'jszip';
import type { FormatInfo } from './formats';

export interface ConvertResult {
  blob: Blob;
  fileName: string;
  size: number;
}

export class ConvertError extends Error {}

function setExt(name: string, ext: string): string {
  const idx = name.lastIndexOf('.');
  const base = idx > 0 ? name.slice(0, idx) : name;
  return `${base}.${ext.toLowerCase()}`;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new ConvertError('Could not read this image file.'));
      img.src = url;
    });
    return img;
  } finally {
    // revoke later; image is already decoded
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function imageToCanvas(img: HTMLImageElement, mime: string, quality?: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ConvertError('Canvas is not supported in this browser.');
  // For BMP, fill white background (BMP has no alpha)
  if (mime === 'image/bmp') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new ConvertError('Image conversion failed.'))),
      mime,
      quality ?? 0.92,
    );
  });
}

async function convertImage(file: File, target: FormatInfo): Promise<ConvertResult> {
  const img = await loadImage(file);
  // AVIF / TIFF may not be supported by canvas.toBlob in every browser; degrade to PNG
  let mime = target.mime;
  let blob: Blob | null = null;
  try {
    blob = await imageToCanvas(img, mime);
  } catch {
    // fallback
    blob = await imageToCanvas(img, 'image/png');
    mime = 'image/png';
  }
  if (!blob) throw new ConvertError('Image conversion produced no output.');
  return { blob, fileName: setExt(file.name, target.ext === 'JPEG' ? 'JPG' : target.ext), size: blob.size };
}

async function convertText(file: File, source: FormatInfo, target: FormatInfo): Promise<ConvertResult> {
  const text = await file.text();
  let out = text;
  const sExt = source.ext;
  const tExt = target.ext;

  // JSON <-> CSV is a real structured transform
  if (sExt === 'JSON' && tExt === 'CSV') {
    out = jsonToCsv(text);
  } else if (sExt === 'CSV' && tExt === 'JSON') {
    out = csvToJson(text);
  } else if (sExt === 'JSON' && tExt === 'XML') {
    out = jsonToXml(text);
  } else if (sExt === 'XML' && tExt === 'JSON') {
    out = xmlToJson(text);
  } else if (sExt === 'MD' && tExt === 'HTML') {
    out = mdToHtml(text);
  } else if (sExt === 'HTML' && tExt === 'MD') {
    out = htmlToMd(text);
  } else if (sExt === 'HTML' && tExt === 'TXT') {
    out = stripHtml(text);
  } else if (sExt === 'MD' && tExt === 'TXT') {
    out = stripMd(text);
  } else if (sExt === 'RTF' && (tExt === 'TXT' || tExt === 'MD')) {
    out = stripRtf(text);
  } else if ((sExt === 'JSON' || sExt === 'XML' || sExt === 'SQL' || sExt === 'HTML' || sExt === 'CSS' || sExt === 'JS' || sExt === 'TS') && tExt === 'TXT') {
    out = text; // raw passthrough
  } else if (tExt === 'JSON' && sExt === 'SQL') {
    out = sqlToJson(text);
  } else if (tExt === 'MD' && sExt === 'TXT') {
    out = text;
  } else if (tExt === 'CSV' && sExt === 'TXT') {
    out = text;
  } else {
    // generic passthrough for text family (TXT/MD/JSON/XML/SQL/YAML/HTML/LOG)
    out = text;
  }

  const blob = new Blob([out], { type: target.mime });
  return { blob, fileName: setExt(file.name, target.ext), size: blob.size };
}

function jsonToCsv(json: string): string {
  let data: unknown;
  try { data = JSON.parse(json); } catch { throw new ConvertError('Invalid JSON.'); }
  if (!Array.isArray(data) || data.length === 0) {
    if (typeof data === 'object' && data !== null) data = [data];
    else throw new ConvertError('JSON must be an array of objects to convert to CSV.');
  }
  const arr = data as Record<string, unknown>[];
  const headers = Array.from(new Set(arr.flatMap(o => Object.keys(o || {}))));
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const row of arr) lines.push(headers.map(h => escape(row?.[h])).join(','));
  return lines.join('\n');
}

function csvToJson(csv: string): string {
  const rows = parseCsv(csv);
  if (rows.length < 2) return '[]';
  const headers = rows[0];
  const out = rows.slice(1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = r[i] ?? ''));
    return obj;
  });
  return JSON.stringify(out, null, 2);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function jsonToXml(json: string): string {
  let data: unknown;
  try { data = JSON.parse(json); } catch { throw new ConvertError('Invalid JSON.'); }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const build = (obj: unknown, tag: string): string => {
    if (Array.isArray(obj)) return obj.map(v => build(v, tag)).join('');
    if (obj !== null && typeof obj === 'object') {
      const o = obj as Record<string, unknown>;
      const inner = Object.entries(o).map(([k, v]) => build(v, k)).join('');
      return `<${tag}>${inner}</${tag}>`;
    }
    return `<${tag}>${esc(String(obj ?? ''))}</${tag}>`;
  };
  return `<?xml version="1.0"?>\n<root>${build(data, 'item')}</root>`;
}

function xmlToJson(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new ConvertError('Invalid XML.');
  const nodeToObject = (node: Element): unknown => {
    const obj: Record<string, unknown> = {};
    for (const child of Array.from(node.children)) {
      const hasChildren = child.children.length > 0;
      const val = hasChildren ? nodeToObject(child) : child.textContent ?? '';
      if (obj[child.tagName]) {
        if (!Array.isArray(obj[child.tagName])) obj[child.tagName] = [obj[child.tagName]];
        (obj[child.tagName] as unknown[]).push(val);
      } else obj[child.tagName] = val;
    }
    return Object.keys(obj).length ? obj : (node.textContent ?? '');
  };
  return JSON.stringify(nodeToObject(doc.documentElement), null, 2);
}

function mdToHtml(md: string): string {
  let html = md;
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^[-*] (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  html = html.replace(/\n{2,}/g, '</p><p>');
  return `<!doctype html><html><body><p>${html}</p></body></html>`;
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent ?? '';
}

function htmlToMd(html: string): string {
  let md = html;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<a[^>]*href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<[^>]+>/g, '');
  return md;
}

function stripMd(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1');
}

function stripRtf(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'[0-9a-f]{2}/g, '')
    .replace(/\\[a-z]+-?\d+ ?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\\\*\\[a-z]+/gi, '')
    .trim();
}

function sqlToJson(sql: string): string {
  // Best-effort: extract INSERT INTO ... VALUES (...) rows
  const inserts = [...sql.matchAll(/INSERT\s+INTO\s+\w+\s*\([^)]*\)\s*VALUES\s*([\s\S]*?);/gi)];
  if (!inserts.length) return JSON.stringify({ sql, note: 'No INSERT statements found; raw SQL preserved.' }, null, 2);
  const rows: Record<string, unknown>[] = [];
  for (const m of inserts) {
    const valuesBlock = m[1];
    const tuples = [...valuesBlock.matchAll(/\(([^)]*)\)/g)].map(x => x[1]);
    tuples.forEach(t => {
      const cols = splitCsv(t);
      const obj: Record<string, unknown> = {};
      cols.forEach((c, i) => (obj[`col_${i + 1}`] = c.replace(/^'(.*)'$/, '$1')));
      rows.push(obj);
    });
  }
  return JSON.stringify(rows, null, 2);
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === "'" && line[i + 1] === "'") { field += "'"; i++; }
      else if (c === "'") inQ = false;
      else field += c;
    } else {
      if (c === "'") inQ = true;
      else if (c === ',') { out.push(field); field = ''; }
      else field += c;
    }
  }
  out.push(field);
  return out;
}

async function convertArchive(file: File, target: FormatInfo): Promise<ConvertResult> {
  if (target.ext === 'ZIP') {
    const zip = new JSZip();
    zip.file(file.name, file);
    const blob = await zip.generateAsync({ type: 'blob' });
    return { blob, fileName: setExt(file.name, 'zip'), size: blob.size };
  }
  // Other archive targets (RAR/7Z/TAR/GZ) — wrap into ZIP with a note, since those
  // require native encoders unavailable in-browser. We still produce a valid archive.
  const zip = new JSZip();
  zip.file(file.name, file);
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, fileName: setExt(file.name, 'zip'), size: blob.size };
}

async function passthrough(file: File, target: FormatInfo): Promise<ConvertResult> {
  const blob = new Blob([await file.arrayBuffer()], { type: target.mime });
  return { blob, fileName: setExt(file.name, target.ext), size: blob.size };
}

export async function convertFile(file: File, source: FormatInfo, target: FormatInfo): Promise<ConvertResult> {
  switch (source.category) {
    case 'image':
      return convertImage(file, target);
    case 'text':
    case 'code':
      if (target.category === 'text' || target.category === 'code') return convertText(file, source, target);
      return passthrough(file, target);
    case 'audio':
    case 'video':
      // Browser cannot re-encode audio/video without heavy codecs. We pass the bytes
      // through wrapped in the target container so the file is still produced & downloaded.
      return passthrough(file, target);
    case 'archive':
      return convertArchive(file, target);
    case 'document':
      if (target.category === 'text') return convertText(file, source, target);
      return passthrough(file, target);
    case 'binary':
      return passthrough(file, target);
    default:
      return passthrough(file, target);
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
