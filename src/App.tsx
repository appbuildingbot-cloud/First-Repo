import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CircleCheck as CheckCircle2, FileCode2, FileText, Github, Image as ImageIcon, Layers, Loader as Loader2, Sparkles, Trash2, Upload, X, Zap, Code as Code2, Type, Music, Video, Archive, Cpu, Circle as XCircle, Clock } from 'lucide-react';
import {
  FORMATS, FORMAT_MAP, CATEGORY_META, type Category, type FormatInfo,
  getFormat, targetsFor, extOf,
} from './formats';
import { convertFile, downloadBlob, ConvertError } from './converter';
import { renderCodeToImage, RenderError } from './codeRenderer';
import {
  fetchHistory, logConversion, clearHistory, type ConversionRecord,
} from './supabase';

const ICONS: Record<string, React.ComponentType<{ size?: number | string }>> = {
  Image: ImageIcon, FileText, Type, Music, Video, Code2, Archive, Cpu,
};

const EXT_COLOR: Record<Category, string> = {
  image: '#06b6d4', document: '#f59e0b', text: '#10b981', audio: '#ec4899',
  video: '#8b5cf6', code: '#3b82f6', archive: '#ef4444', binary: '#64748b',
};

const CATEGORY_ORDER: Category[] = ['image', 'document', 'text', 'audio', 'video', 'code', 'archive', 'binary'];

type Tab = 'convert' | 'formats' | 'history';

export default function App() {
  const [tab, setTab] = useState<Tab>('convert');
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<string>('');
  const [codeMode, setCodeMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; size: number; url: string; isImage: boolean } | null>(null);
  const [drag, setDrag] = useState(false);
  const [activeCat, setActiveCat] = useState<Category>('image');
  const [history, setHistory] = useState<ConversionRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const sourceFormat = useMemo<FormatInfo | null>(() => (file ? getFormat(file.name) : null), [file]);
  const unknownFormat = file !== null && sourceFormat === null;

  const targetList = useMemo<FormatInfo[]>(() => {
    if (!sourceFormat) return [];
    if (codeMode && sourceFormat.category === 'code') {
      // code -> image: all image targets available
      return FORMATS.filter(f => f.category === 'image');
    }
    return targetsFor(sourceFormat);
  }, [sourceFormat, codeMode]);

  useEffect(() => {
    if (targetList.length && !targetList.some(t => t.ext === target)) {
      setTarget(targetList[0].ext);
    }
  }, [targetList, target]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]);

  const loadHistory = async () => setHistory(await fetchHistory());

  const onPickFile = useCallback((f: File | null) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onPickFile(f);
  }, [onPickFile]);

  const runConvert = async () => {
    if (!file || !sourceFormat || !target) return;
    const targetFmt = FORMAT_MAP[target];
    if (!targetFmt) return;
    setBusy(true); setError(null); setResult(null);
    try {
      let res;
      let category = sourceFormat.category;
      if (codeMode && sourceFormat.category === 'code') {
        res = await renderCodeToImage(file, sourceFormat, targetFmt);
        category = 'image';
      } else {
        res = await convertFile(file, sourceFormat, targetFmt);
      }
      downloadBlob(res.blob, res.fileName);
      const isImage = targetFmt.category === 'image' || (codeMode && sourceFormat.category === 'code');
      const url = isImage ? URL.createObjectURL(res.blob) : '';
      setResult({ name: res.fileName, size: res.size, url, isImage });
      await logConversion({
        source_name: file.name,
        source_format: sourceFormat.ext,
        target_format: targetFmt.ext,
        category,
        result_name: res.fileName,
        result_size: res.size,
        status: 'success',
      });
    } catch (err) {
      const msg = err instanceof ConvertError || err instanceof RenderError
        ? err.message
        : 'Conversion failed. Try a different file or target format.';
      setError(msg);
      await logConversion({
        source_name: file.name,
        source_format: sourceFormat.ext,
        target_format: targetFmt.ext,
        category: sourceFormat.category,
        result_name: null,
        result_size: null,
        status: 'failed',
      });
    } finally {
      setBusy(false);
    }
  };

  const onClearHistory = async () => {
    await clearHistory();
    setHistory([]);
  };

  const supportedCount = FORMATS.length;

  return (
    <>
      <div className="app-bg" />
      <header className="header">
        <div className="container header-inner">
          <div className="logo">
            <span className="logo-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="#04121a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 8h6l5 8M17 16h-6L6 8" />
                <circle cx="7" cy="8" r="1.5" fill="#04121a" />
                <circle cx="17" cy="16" r="1.5" fill="#04121a" />
              </svg>
            </span>
            Convertly
          </div>
          <nav className="nav">
            <button className={`nav-btn ${tab === 'convert' ? 'active' : ''}`} onClick={() => setTab('convert')}>Convert</button>
            <button className={`nav-btn ${tab === 'formats' ? 'active' : ''}`} onClick={() => setTab('formats')}>Formats</button>
            <button className={`nav-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
          </nav>
          <a className="gh-link" href="https://github.com" target="_blank" rel="noreferrer">
            <Github size={15} /> GitHub
          </a>
        </div>
      </header>

      <main className="container">
        {tab === 'convert' && (
          <>
            <section className="hero">
              <div className="hero-badge"><Sparkles size={13} /> Universal converter · {supportedCount}+ formats</div>
              <h1>Convert any file.<br />Beautifully.</h1>
              <p>Drop in images, documents, audio, video, code, archives, even CAD files — and convert them in seconds. Plus a special mode that renders your code into the actual image it produces.</p>
              <div className="hero-stats">
                <div className="stat"><div className="stat-num">{supportedCount}+</div><div className="stat-label">Formats</div></div>
                <div className="stat"><div className="stat-num">8</div><div className="stat-label">Categories</div></div>
                <div className="stat"><div className="stat-num">100%</div><div className="stat-label">In-browser</div></div>
              </div>
            </section>

            {!file && (
              <div
                className={`dropzone ${drag ? 'drag' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <div className="dropzone-icon"><Upload size={30} /></div>
                <h3>Drop a file to convert</h3>
                <p>or <span className="browse">browse your device</span> — images, docs, audio, video, code & more</p>
                <input ref={inputRef} type="file" hidden onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
              </div>
            )}

            {file && sourceFormat && (
              <section className="converter fade-up">
                <div className="card">
                  <div className="converter-grid">
                    <div className="convert-col">
                      <div className="label">Source</div>
                      <div className="file-chip">
                        <div className="file-chip-icon" style={{ background: `${EXT_COLOR[sourceFormat.category]}22`, color: EXT_COLOR[sourceFormat.category] }}>
                          {sourceFormat.ext.slice(0, 4)}
                        </div>
                        <div className="file-chip-meta">
                          <div className="file-chip-name">{file.name}</div>
                          <div className="file-chip-sub">{sourceFormat.label} · {formatBytes(file.size)}</div>
                        </div>
                        <button className="file-chip-x" onClick={() => { setFile(null); setResult(null); setError(null); }} aria-label="Remove file">
                          <X size={16} />
                        </button>
                      </div>
                      <div>
                        <div className="label">Detected format</div>
                        <div className="select" style={{ cursor: 'default' }}>{sourceFormat.ext} — {sourceFormat.label}</div>
                      </div>
                    </div>

                    <div className="convert-arrow"><ArrowRight size={26} /></div>

                    <div className="convert-col">
                      <div className="label">Convert to</div>
                      <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
                        {targetList.map(t => (
                          <option key={t.ext} value={t.ext}>{t.ext} — {t.label}</option>
                        ))}
                      </select>

                      {sourceFormat.category === 'code' && (
                        <div className="feature-banner" style={{ margin: 0, padding: 16 }}>
                          <div className="feature-banner-icon" style={{ width: 40, height: 40 }}><Code2 size={20} /></div>
                          <div className="feature-banner-text">
                            <h3 style={{ fontSize: 15 }}>Render code to image</h3>
                            <p>Outputs the actual visual the code produces — not a screenshot of text.</p>
                          </div>
                          <label className="switch-toggle">
                            <input type="checkbox" checked={codeMode} onChange={(e) => setCodeMode(e.target.checked)} />
                            <span className="slider" />
                          </label>
                        </div>
                      )}

                      <button className="btn btn-primary" onClick={runConvert} disabled={busy || !target}>
                        {busy ? <span className="spinner" /> : <Zap size={18} />}
                        {busy ? 'Converting…' : 'Convert & Download'}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="error-box"><XCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span>{error}</span></div>
                  )}

                  {result && (
                    <div className="result fade-up">
                      <div className="result-icon"><CheckCircle2 size={24} /></div>
                      <div className="result-meta">
                        <div className="result-title">{result.name}</div>
                        <div className="result-sub">{formatBytes(result.size)} · ready to download</div>
                        {result.isImage && result.url && (
                          <img className="result-preview" src={result.url} alt="Converted result preview" />
                        )}
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => {
                        // re-trigger download from the in-memory blob URL
                        const a = document.createElement('a');
                        a.href = result.url || '#';
                        a.download = result.name;
                        a.click();
                      }}>
                        <Upload size={15} /> Download again
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {unknownFormat && (
              <section className="converter fade-up">
                <div className="card">
                  <div className="error-box">
                    <XCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>We don't recognize the <strong>.{extOf(file.name)}</strong> format yet. Try a file from the supported list on the Formats tab.</span>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={() => setFile(null)}>Choose another file</button>
                </div>
              </section>
            )}

            {!file && (
              <>
                <div className="feature-banner">
                  <div className="feature-banner-icon"><Code2 size={26} /></div>
                  <div className="feature-banner-text">
                    <h3>Code → Image, for real</h3>
                    <p>Toggle "render code to image" on any code file. We execute drawing code, render HTML/CSS, draw SVG, plot JSON trees, and interpret turtle graphics — producing the visual the code actually describes.</p>
                  </div>
                </div>

                <section className="section">
                  <div className="section-head">
                    <h2>One tool, every file</h2>
                    <p>Pick a category to explore the formats Convertly handles.</p>
                  </div>
                  <div className="cat-tabs">
                    {CATEGORY_ORDER.map(c => {
                      const Icon = ICONS[CATEGORY_META[c].icon];
                      return (
                        <button key={c} className={`cat-tab ${activeCat === c ? 'active' : ''}`}
                          style={activeCat === c ? { background: CATEGORY_META[c].color } : {}}
                          onClick={() => setActiveCat(c)}>
                          <Icon size={14} /> {CATEGORY_META[c].label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="format-grid">
                    {FORMATS.filter(f => f.category === activeCat).map(f => (
                      <div key={f.ext} className="format-pill">
                        <div className="ext" style={{ color: EXT_COLOR[f.category] }}>{f.ext}</div>
                        <div className="desc">{f.label}</div>
                        <span className="badge" style={{ background: `${EXT_COLOR[f.category]}22`, color: EXT_COLOR[f.category] }}>{CATEGORY_META[f.category].label}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="section" style={{ paddingTop: 0 }}>
                  <div className="section-head"><h2>Built for speed</h2></div>
                  <div className="features">
                    <div className="feature">
                      <div className="feature-icon" style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}><Zap size={24} /></div>
                      <h3>Runs in your browser</h3>
                      <p>Files never leave your device. Conversions happen locally using canvas, Web APIs, and streaming — no uploads, no waiting.</p>
                    </div>
                    <div className="feature">
                      <div className="feature-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}><Layers size={24} /></div>
                      <h3>{supportedCount}+ formats</h3>
                      <p>Images, documents, text, data, audio, video, code, archives, CAD, and executables — all in one clean place.</p>
                    </div>
                    <div className="feature">
                      <div className="feature-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}><Code2 size={24} /></div>
                      <h3>Code that draws</h3>
                      <p>Render HTML, CSS, SVG, JSON, Markdown, and drawing code into the actual image it describes — not a screenshot of the source.</p>
                    </div>
                    <div className="feature">
                      <div className="feature-icon" style={{ background: 'rgba(244,114,182,0.15)', color: '#f472b6' }}><Clock size={24} /></div>
                      <h3>Saved history</h3>
                      <p>Every conversion is logged so you can revisit what you've converted, when, and to what format.</p>
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {tab === 'formats' && (
          <section className="section">
            <div className="section-head">
              <h2>All {supportedCount} supported formats</h2>
              <p>Everything Convertly can read and produce, grouped by category.</p>
            </div>
            {CATEGORY_ORDER.map(c => {
              const Icon = ICONS[CATEGORY_META[c].icon];
              const items = FORMATS.filter(f => f.category === c);
              if (!items.length) return null;
              return (
                <div key={c} style={{ marginBottom: 36 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Icon size={18} />
                    <h3 style={{ fontSize: 18 }}>{CATEGORY_META[c].label}</h3>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{items.length} formats</span>
                  </div>
                  <div className="format-grid">
                    {items.map(f => (
                      <div key={f.ext} className="format-pill">
                        <div className="ext" style={{ color: EXT_COLOR[c] }}>{f.ext}</div>
                        <div className="desc">{f.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {tab === 'history' && (
          <section className="section">
            <div className="section-head">
              <h2>Conversion history</h2>
              <p>A log of everything you've converted in this browser.</p>
            </div>
            <div className="card">
              {history.length === 0 ? (
                <div className="empty">No conversions yet. Drop a file on the Convert tab to get started.</div>
              ) : (
                <>
                  <div className="history-list">
                    {history.map(h => (
                      <div key={h.id} className="history-item">
                        <div className="history-flow">
                          <span className="history-tag" style={{ background: `${EXT_COLOR[(h.category as Category)] ?? '#64748b'}22`, color: EXT_COLOR[(h.category as Category)] ?? '#64748b' }}>{h.source_format}</span>
                          <ArrowRight size={14} className="history-arrow" />
                          <span className="history-tag" style={{ background: `${EXT_COLOR[(h.category as Category)] ?? '#64748b'}22`, color: EXT_COLOR[(h.category as Category)] ?? '#64748b' }}>{h.target_format}</span>
                          <span className="history-name">{h.source_name}{h.result_name ? ` → ${h.result_name}` : ''}</span>
                        </div>
                        <span className={`history-status ${h.status}`}>{h.status}</span>
                        <span className="history-time">{new Date(h.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 18 }} onClick={onClearHistory}>
                    <Trash2 size={15} /> Clear history
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        <footer className="footer">
          Convertly · Universal file converter · Open source on GitHub
        </footer>
      </main>
    </>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
