import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CircleCheck as CheckCircle2, FileText, Image as ImageIcon, Layers, Sparkles, Trash2, Upload, X, Zap, Code as Code2, Type, Music, Video, Archive, Cpu, Circle as XCircle, Clock, Eye, Download, Mic, MicOff, Search, BookOpen, Wand as Wand2, ClipboardList } from 'lucide-react';
import {
  FORMATS, FORMAT_MAP, CATEGORY_META, type Category, type FormatInfo,
  getFormat, targetsFor, extOf,
} from './formats';
import { convertFile, downloadBlob, ConvertError } from './converter';
import {
  renderCodeToImage, renderCodeCanvas, makeThumbnail, detectMode,
  type CodeMode, type RenderResult, RenderError, CODE_MODE_OPTIONS,
} from './codeRenderer';
import {
  fetchHistory, logConversion, clearHistory, type ConversionRecord,
} from './supabase';
import { findExamples, type HtmlExample } from './htmlExamples';
import {
  parseSoap, soapToHtml, createSpeechRecognition, speechSupported,
  type SoapNote, type SoapSection, type SpeechRecognitionLike,
} from './soapNotes';

const ICONS: Record<string, React.ComponentType<{ size?: number | string }>> = {
  Image: ImageIcon, FileText, Type, Music, Video, Code2, Archive, Cpu,
};

const EXT_COLOR: Record<Category, string> = {
  image: '#06b6d4', document: '#f59e0b', text: '#10b981', audio: '#ec4899',
  video: '#8b5cf6', code: '#3b82f6', archive: '#ef4444', binary: '#64748b',
};

const CATEGORY_ORDER: Category[] = ['image', 'document', 'text', 'audio', 'video', 'code', 'archive', 'binary'];

const SAMPLE_HTML = `<div style="min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#06b6d4,#10b981);font-family:Inter,sans-serif">
  <div style="background:#fff;padding:48px 56px;border-radius:24px;box-shadow:0 20px 60px rgba(0,0,0,.15);text-align:center">
    <h1 style="margin:0 0 12px;color:#0f172a;font-size:42px">Hello, world</h1>
    <p style="margin:0;color:#64748b;font-size:18px">Rendered live from your code</p>
    <button style="margin-top:24px;padding:12px 28px;border:0;border-radius:999px;background:linear-gradient(135deg,#06b6d4,#10b981);color:#04121a;font-weight:600;font-size:16px;cursor:pointer">Get started</button>
  </div>
</div>`;

type Tab = 'convert' | 'code' | 'text2html' | 'soap' | 'formats' | 'history';

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

  // Code > Image tab state
  const [codeInput, setCodeInput] = useState<string>(SAMPLE_HTML);
  const [codeLang, setCodeLang] = useState<CodeMode>('html');
  const [codePreview, setCodePreview] = useState<string>('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeResult, setCodeResult] = useState<RenderResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Text > HTML tab state
  const [t2hQuery, setT2hQuery] = useState('');
  const [t2hExamples, setT2hExamples] = useState<HtmlExample[]>([]);
  const [t2hCode, setT2hCode] = useState('');
  const [t2hPreview, setT2hPreview] = useState('');
  const [t2hError, setT2hError] = useState<string | null>(null);
  const [t2hBusy, setT2hBusy] = useState(false);
  const [t2hResult, setT2hResult] = useState<RenderResult | null>(null);
  const t2hDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SOAP notes tab state
  const [soapTranscript, setSoapTranscript] = useState('');
  const [soapNote, setSoapNote] = useState<SoapNote | null>(null);
  const [soapListening, setSoapListening] = useState(false);
  const [soapError, setSoapError] = useState<string | null>(null);
  const [soapStudyMode, setSoapStudyMode] = useState(true);
  const [soapPreview, setSoapPreview] = useState('');
  const [soapBusy, setSoapBusy] = useState(false);
  const [soapResult, setSoapResult] = useState<RenderResult | null>(null);
  const soapRecRef = useRef<SpeechRecognitionLike | null>(null);

  const sourceFormat = useMemo<FormatInfo | null>(() => (file ? getFormat(file.name) : null), [file]);
  const unknownFormat = file !== null && sourceFormat === null;

  const targetList = useMemo<FormatInfo[]>(() => {
    if (!sourceFormat) return [];
    if (codeMode && sourceFormat.category === 'code') {
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
    if (tab === 'soap') stopListening();
  }, [tab]);

  // Live preview for Code > Image tab
  useEffect(() => {
    if (tab !== 'code') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!codeInput.trim()) { setCodePreview(''); setCodeError(null); return; }
    debounceRef.current = setTimeout(() => {
      void updateCodePreview();
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeInput, codeLang, tab]);

  const updateCodePreview = async () => {
    setCodeError(null);
    try {
      const canvas = await renderCodeCanvas(codeInput, codeLang);
      const url = canvas.toDataURL('image/png');
      setCodePreview(url);
      setCodeResult(null);
    } catch (err) {
      setCodePreview('');
      setCodeError(err instanceof RenderError ? err.message : 'Could not render this code.');
    }
  };

  // Text > HTML live preview
  useEffect(() => {
    if (tab !== 'text2html') return;
    if (t2hDebounce.current) clearTimeout(t2hDebounce.current);
    if (!t2hCode.trim()) { setT2hPreview(''); setT2hError(null); return; }
    t2hDebounce.current = setTimeout(() => { void updateT2hPreview(); }, 400);
    return () => { if (t2hDebounce.current) clearTimeout(t2hDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t2hCode, tab]);

  const updateT2hPreview = async () => {
    setT2hError(null);
    try {
      const canvas = await renderCodeCanvas(t2hCode, 'html');
      setT2hPreview(canvas.toDataURL('image/png'));
      setT2hResult(null);
    } catch (err) {
      setT2hPreview('');
      setT2hError(err instanceof RenderError ? err.message : 'Could not render this HTML.');
    }
  };

  const runT2hSearch = () => {
    const found = findExamples(t2hQuery, 6);
    setT2hExamples(found);
  };

  const renderT2hImage = async () => {
    if (!t2hCode.trim() || !t2hPreview) return;
    setT2hBusy(true); setT2hError(null);
    try {
      const canvas = await renderCodeCanvas(t2hCode, 'html');
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new RenderError('Rendering produced no image.')), 'image/png', 0.95),
      );
      const fileName = 'text-to-html.png';
      const dataUrl = canvas.toDataURL('image/png');
      const res: RenderResult = { blob, fileName, size: blob.size, dataUrl };
      setT2hResult(res);
      downloadBlob(res.blob, res.fileName);
      await logConversion({
        source_name: `text: ${t2hQuery.slice(0, 40) || 'html'}`,
        source_format: 'TXT',
        target_format: 'PNG',
        category: 'image',
        result_name: res.fileName,
        result_size: res.size,
        status: 'success',
        preview_data: makeThumbnail(canvas, 280),
      });
    } catch (err) {
      setT2hError(err instanceof RenderError ? err.message : 'Could not render this HTML to an image.');
    } finally {
      setT2hBusy(false);
    }
  };

  // SOAP: regenerate note + preview whenever transcript/mode changes
  useEffect(() => {
    if (tab !== 'soap') return;
    if (!soapTranscript.trim()) {
      setSoapNote(null); setSoapPreview(''); return;
    }
    const note = parseSoap(soapTranscript, soapStudyMode);
    setSoapNote(note);
    void (async () => {
      try {
        const canvas = await renderCodeCanvas(soapToHtml(note), 'html');
        setSoapPreview(canvas.toDataURL('image/png'));
        setSoapResult(null);
      } catch {
        setSoapPreview('');
      }
    })();
  }, [soapTranscript, soapStudyMode, tab]);

  const startListening = () => {
    if (!speechSupported()) {
      setSoapError('Your browser does not support speech recognition. Try Chrome or Edge.');
      return;
    }
    const rec = createSpeechRecognition();
    if (!rec) return;
    let finalText = soapTranscript;
    rec.onresult = (e) => {
      let interim = '';
      const results = e.results as unknown as { [key: number]: { 0: { transcript: string } } };
      for (let i = e.resultIndex; i < (e.results as { length: number }).length; i++) {
        interim += results[i][0].transcript;
      }
      setSoapTranscript((finalText + ' ' + interim).trim());
    };
    rec.onerror = () => setSoapError('Speech recognition error. Check microphone access and try again.');
    rec.onend = () => setSoapListening(false);
    rec.start();
    soapRecRef.current = rec;
    setSoapListening(true);
    setSoapError(null);
  };

  const stopListening = () => {
    if (soapRecRef.current) {
      soapRecRef.current.abort();
      soapRecRef.current = null;
    }
    setSoapListening(false);
  };

  const renderSoapImage = async () => {
    if (!soapNote || !soapPreview) return;
    setSoapBusy(true); setSoapError(null);
    try {
      const canvas = await renderCodeCanvas(soapToHtml(soapNote), 'html');
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new RenderError('Rendering produced no image.')), 'image/png', 0.95),
      );
      const fileName = 'soap-notes.png';
      const dataUrl = canvas.toDataURL('image/png');
      const res: RenderResult = { blob, fileName, size: blob.size, dataUrl };
      setSoapResult(res);
      downloadBlob(res.blob, res.fileName);
      await logConversion({
        source_name: 'soap notes (voice)',
        source_format: 'VOICE',
        target_format: 'PNG',
        category: 'image',
        result_name: res.fileName,
        result_size: res.size,
        status: 'success',
        preview_data: makeThumbnail(canvas, 280),
      });
    } catch {
      setSoapError('Could not render SOAP notes to an image.');
    } finally {
      setSoapBusy(false);
    }
  };

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
        preview_data: (res as { dataUrl?: string }).dataUrl ?? null,
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

  const runCodeImage = async () => {
    if (!codeInput.trim() || !codePreview) return;
    setCodeBusy(true); setCodeError(null);
    try {
      const canvas = await renderCodeCanvas(codeInput, codeLang);
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new RenderError('Rendering produced no image.')), 'image/png', 0.95),
      );
      const fileName = `code-image.${codeLang === 'svg' ? 'svg' : 'png'}`;
      const dataUrl = canvas.toDataURL('image/png');
      const res: RenderResult = { blob, fileName, size: blob.size, dataUrl };
      setCodeResult(res);
      downloadBlob(res.blob, res.fileName);
      await logConversion({
        source_name: `code (${codeLang})`,
        source_format: codeLang.toUpperCase(),
        target_format: 'PNG',
        category: 'image',
        result_name: res.fileName,
        result_size: res.size,
        status: 'success',
        preview_data: makeThumbnail(canvas, 280),
      });
    } catch (err) {
      setCodeError(err instanceof RenderError ? err.message : 'Could not render this code to an image.');
    } finally {
      setCodeBusy(false);
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
            <button className={`nav-btn ${tab === 'code' ? 'active' : ''}`} onClick={() => setTab('code')}>Code &gt; Image</button>
            <button className={`nav-btn ${tab === 'text2html' ? 'active' : ''}`} onClick={() => setTab('text2html')}>Text → HTML</button>
            <button className={`nav-btn ${tab === 'soap' ? 'active' : ''}`} onClick={() => setTab('soap')}>SOAP Notes</button>
            <button className={`nav-btn ${tab === 'formats' ? 'active' : ''}`} onClick={() => setTab('formats')}>Formats</button>
            <button className={`nav-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
          </nav>
        </div>
      </header>

      <main className="container">
        {tab === 'convert' && (
          <>
            <section className="hero">
              <div className="hero-badge"><Sparkles size={13} /> Universal converter · {supportedCount}+ formats</div>
              <h1>Convert any file.<br />Beautifully.</h1>
              <p>Drop in images, documents, audio, video, code, archives, even CAD files — and convert them in seconds. Try the Code &gt; Image tab to turn any code into the real picture it produces.</p>
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
                    <p>Open the Code &gt; Image tab to paste any HTML, CSS, SVG, Markdown, JSON, Canvas JS, or turtle graphics — and watch it render into the actual image it describes, with a live preview before you download.</p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setTab('code')}>Try it <ArrowRight size={15} /></button>
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
                      <p>Every conversion is logged with a thumbnail preview so you can revisit what you've made.</p>
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {tab === 'code' && (
          <section className="code-tab fade-up">
            <div className="section-head">
              <h2>Code &gt; Image</h2>
              <p>Paste any code and watch it render into the real image it produces — live, before you download.</p>
            </div>

            <div className="code-grid">
              <div className="code-editor">
                <div className="label">Your code</div>
                <div className="code-toolbar">
                  {CODE_MODE_OPTIONS.map(m => (
                    <button
                      key={m.id}
                      className={`mode-btn ${codeLang === m.id ? 'active' : ''}`}
                      onClick={() => { setCodeLang(m.id); setCodeResult(null); }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="code-hint">
                  {CODE_MODE_OPTIONS.find(m => m.id === codeLang)?.hint}
                </div>
                <textarea
                  className="code-textarea"
                  value={codeInput}
                  onChange={(e) => { setCodeInput(e.target.value); setCodeResult(null); }}
                  spellCheck={false}
                  placeholder={`Paste ${codeLang.toUpperCase()} here…`}
                />
                <div className="code-actions">
                  <button
                    className="btn btn-primary"
                    onClick={runCodeImage}
                    disabled={codeBusy || !codePreview}
                  >
                    {codeBusy ? <span className="spinner" /> : <Download size={18} />}
                    {codeBusy ? 'Rendering…' : 'Download PNG'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setCodeInput(''); setCodePreview(''); setCodeResult(null); setCodeError(null); }}
                  >
                    <X size={15} /> Clear
                  </button>
                </div>
                {codeError && (
                  <div className="error-box"><XCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span>{codeError}</span></div>
                )}
              </div>

              <div className="code-preview">
                <div className="code-preview-label">
                  <Eye size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                  Live preview
                </div>
                <div className="code-preview-frame">
                  {codePreview
                    ? <img src={codePreview} alt="Rendered code preview" />
                    : <div className="code-preview-empty">Your rendered image will appear here as you type.</div>}
                </div>
                {codeResult && (
                  <div className="result fade-up" style={{ marginTop: 0 }}>
                    <div className="result-icon"><CheckCircle2 size={24} /></div>
                    <div className="result-meta">
                      <div className="result-title">{codeResult.fileName}</div>
                      <div className="result-sub">{formatBytes(codeResult.size)} · downloaded</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => downloadBlob(codeResult.blob, codeResult.fileName)}>
                      <Download size={15} /> Download again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {tab === 'text2html' && (
          <section className="code-tab fade-up">
            <div className="section-head">
              <h2>Text → HTML</h2>
              <p>Type what you want, like “html for a cat”, pick an example, then render it into a real image.</p>
            </div>

            <div className="t2h-search">
              <div className="t2h-search-bar">
                <Search size={18} className="t2h-search-icon" />
                <input
                  className="t2h-search-input"
                  placeholder="Try: html for a cat, a button, a hero section…"
                  value={t2hQuery}
                  onChange={(e) => setT2hQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runT2hSearch(); }}
                />
                <button className="btn btn-primary btn-sm" onClick={runT2hSearch}>
                  <Wand2 size={15} /> Find examples
                </button>
              </div>
            </div>

            {t2hExamples.length > 0 && (
              <div className="t2h-examples">
                {t2hExamples.map(ex => (
                  <button
                    key={ex.id}
                    className={`t2h-example ${t2hCode === ex.html ? 'active' : ''}`}
                    onClick={() => { setT2hCode(ex.html); }}
                  >
                    {ex.title}
                  </button>
                ))}
              </div>
            )}

            <div className="code-grid">
              <div className="code-editor">
                <div className="label">HTML</div>
                <textarea
                  className="code-textarea"
                  value={t2hCode}
                  onChange={(e) => setT2hCode(e.target.value)}
                  spellCheck={false}
                  placeholder="Your HTML appears here — edit it freely."
                />
                <div className="code-actions">
                  <button className="btn btn-primary" onClick={renderT2hImage} disabled={t2hBusy || !t2hPreview}>
                    {t2hBusy ? <span className="spinner" /> : <Download size={18} />}
                    {t2hBusy ? 'Rendering…' : 'Download PNG'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setT2hCode(''); setT2hPreview(''); setT2hResult(null); setT2hError(null); }}>
                    <X size={15} /> Clear
                  </button>
                </div>
                {t2hError && (
                  <div className="error-box"><XCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span>{t2hError}</span></div>
                )}
              </div>

              <div className="code-preview">
                <div className="code-preview-label">
                  <Eye size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                  Live preview
                </div>
                <div className="code-preview-frame">
                  {t2hPreview
                    ? <img src={t2hPreview} alt="Rendered HTML preview" />
                    : <div className="code-preview-empty">Search for an example and edit the HTML to see it render.</div>}
                </div>
                {t2hResult && (
                  <div className="result fade-up" style={{ marginTop: 0 }}>
                    <div className="result-icon"><CheckCircle2 size={24} /></div>
                    <div className="result-meta">
                      <div className="result-title">{t2hResult.fileName}</div>
                      <div className="result-sub">{formatBytes(t2hResult.size)} · downloaded</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => downloadBlob(t2hResult.blob, t2hResult.fileName)}>
                      <Download size={15} /> Download again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {tab === 'soap' && (
          <section className="code-tab fade-up">
            <div className="section-head">
              <h2>SOAP Notes — Study Mode</h2>
              <p>Talk out loud while you study. Your speech is split into Subjective, Objective, Assessment, and Plan — then rendered into a clean image you can save.</p>
            </div>

            <div className="soap-controls">
              <button
                className={`btn ${soapListening ? 'btn-danger' : 'btn-primary'}`}
                onClick={soapListening ? stopListening : startListening}
              >
                {soapListening ? <MicOff size={18} /> : <Mic size={18} />}
                {soapListening ? 'Stop listening' : 'Start talking'}
              </button>
              <label className="soap-toggle">
                <input type="checkbox" checked={soapStudyMode} onChange={(e) => setSoapStudyMode(e.target.checked)} />
                <BookOpen size={15} /> Study SOAP (Topic / Facts / Understanding / Plan)
              </label>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setSoapTranscript(''); setSoapNote(null); setSoapPreview(''); setSoapResult(null); setSoapError(null); }}
              >
                <X size={15} /> Clear
              </button>
            </div>

            {soapError && (
              <div className="error-box"><XCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span>{soapError}</span></div>
            )}

            <div className="code-grid">
              <div className="code-editor">
                <div className="label">Transcript {soapListening && <span className="soap-live"><span className="soap-live-dot" /> listening</span>}</div>
                <textarea
                  className="code-textarea"
                  value={soapTranscript}
                  onChange={(e) => setSoapTranscript(e.target.value)}
                  spellCheck={false}
                  placeholder="Your speech will appear here. You can also type or paste. Say words like “subjective”, “objective”, “assessment”, “plan” to mark sections."
                />
              </div>

              <div className="code-preview">
                <div className="code-preview-label">
                  <ClipboardList size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                  SOAP notes
                </div>
                <div className="soap-preview-frame">
                  {soapNote && soapNote.sections.some(s => s.text.trim()) ? (
                    <div className="soap-cards">
                      {soapNote.sections.filter(s => s.text.trim()).map(s => (
                        <div className="soap-card" key={s.id} style={{ borderLeftColor: s.color }}>
                          <div className="soap-card-label" style={{ color: s.color }}>{s.label}</div>
                          <div className="soap-card-text">{s.text}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="code-preview-empty">Press “Start talking” and narrate your study notes. Your structured SOAP summary appears here.</div>
                  )}
                </div>
                <div className="code-actions">
                  <button className="btn btn-primary" onClick={renderSoapImage} disabled={soapBusy || !soapPreview}>
                    {soapBusy ? <span className="spinner" /> : <Download size={18} />}
                    {soapBusy ? 'Rendering…' : 'Download as image'}
                  </button>
                  {soapResult && (
                    <button className="btn btn-ghost btn-sm" onClick={() => downloadBlob(soapResult.blob, soapResult.fileName)}>
                      <Download size={15} /> Download again
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
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
              <p>A log of everything you've converted, with image previews where available.</p>
            </div>
            <div className="card">
              {history.length === 0 ? (
                <div className="empty">No conversions yet. Convert a file or render some code to get started.</div>
              ) : (
                <>
                  <div className="history-list">
                    {history.map(h => {
                      const hasPreview = !!h.preview_data;
                      return (
                        <div key={h.id} className={`history-item ${hasPreview ? 'with-preview' : ''}`}>
                          {hasPreview && (
                            <img className="history-thumb" src={h.preview_data!} alt="Result preview" />
                          )}
                          <div className="history-body">
                            <div className="history-flow">
                              <span className="history-tag" style={{ background: `${EXT_COLOR[(h.category as Category)] ?? '#64748b'}22`, color: EXT_COLOR[(h.category as Category)] ?? '#64748b' }}>{h.source_format}</span>
                              <ArrowRight size={14} className="history-arrow" />
                              <span className="history-tag" style={{ background: `${EXT_COLOR[(h.category as Category)] ?? '#64748b'}22`, color: EXT_COLOR[(h.category as Category)] ?? '#64748b' }}>{h.target_format}</span>
                              <span className="history-name">{h.source_name}{h.result_name ? ` → ${h.result_name}` : ''}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                              <span className={`history-status ${h.status}`}>{h.status}</span>
                              <span className="history-time">{new Date(h.created_at).toLocaleString()}</span>
                              {h.result_size != null && (
                                <span className="history-time">{formatBytes(h.result_size)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
          Convertly · Universal file converter
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
