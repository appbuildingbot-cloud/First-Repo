export interface SoapSection {
  id: 'subjective' | 'objective' | 'assessment' | 'plan';
  label: string;
  color: string;
  text: string;
}

export interface SoapNote {
  sections: SoapSection[];
  raw: string;
}

const SECTION_KEYWORDS: Record<SoapSection['id'], string[]> = {
  subjective: ['subjective', 'chief complaint', 'patient says', 'patient reports', 'complains of', 'feels', 'history'],
  objective: ['objective', 'on exam', 'examination', 'vitals', 'observed', 'measured', 'physical exam'],
  assessment: ['assessment', 'diagnosis', 'impression', 'diagnosed', 'appears to be', 'likely'],
  plan: ['plan', 'treatment', 'prescribe', 'follow up', 'next steps', 'medication', 'therapy', 'orders'],
};

const STUDY_KEYWORDS: Record<SoapSection['id'], string[]> = {
  subjective: ['topic', 'overview', 'summary', 'concept', 'question', 'i need to learn', 'studying', "let's review", 'today we are', 'this is about'],
  objective: ['definition', 'facts', 'key points', 'details', 'notes', 'important', 'remember', 'mentions', 'states'],
  assessment: ['understanding', 'analysis', 'think', 'believe', 'struggle', 'confident', 'gap', 'need to work on', 'evaluation'],
  plan: ['plan', 'study plan', 'next', 'review', 'practice', 'memorize', 'schedule', 'tomorrow', 'homework', 'quiz'],
};

export function parseSoap(transcript: string, studyMode = false): SoapNote {
  const text = transcript.trim();
  const keywords = studyMode ? STUDY_KEYWORDS : SECTION_KEYWORDS;

  const lower = text.toLowerCase();
  const sectionPositions: { id: SoapSection['id']; pos: number }[] = [];
  (Object.keys(keywords) as SoapSection['id'][]).forEach(id => {
    for (const kw of keywords[id]) {
      const idx = lower.indexOf(kw);
      if (idx >= 0) sectionPositions.push({ id, pos: idx });
    }
  });
  sectionPositions.sort((a, b) => a.pos - b.pos);

  const blank = (id: SoapSection['id']): SoapSection => ({
    id,
    label: LABELS[id],
    color: COLORS[id],
    text: '',
  });

  const sections: Record<SoapSection['id'], SoapSection> = {
    subjective: blank('subjective'),
    objective: blank('objective'),
    assessment: blank('assessment'),
    plan: blank('plan'),
  };

  if (sectionPositions.length === 0) {
    // No markers found — dump everything into subjective (or 'topic' for study)
    sections.subjective.text = text;
    return { sections: ORDER.map(id => sections[id]), raw: text };
  }

  for (let i = 0; i < sectionPositions.length; i++) {
    const { id, pos } = sectionPositions[i];
    const end = i + 1 < sectionPositions.length ? sectionPositions[i + 1].pos : text.length;
    const chunk = text.slice(pos, end).trim();
    const existing = sections[id].text;
    sections[id].text = existing ? `${existing}\n${chunk}` : chunk;
  }

  // Anything before the first marker goes to subjective
  if (sectionPositions[0].pos > 0) {
    const pre = text.slice(0, sectionPositions[0].pos).trim();
    if (pre) sections.subjective.text = (sections.subjective.text ? pre + '\n' + sections.subjective.text : pre);
  }

  return { sections: ORDER.map(id => sections[id]), raw: text };
}

const LABELS: Record<SoapSection['id'], string> = {
  subjective: 'Subjective',
  objective: 'Objective',
  assessment: 'Assessment',
  plan: 'Plan',
};

const COLORS: Record<SoapSection['id'], string> = {
  subjective: '#06b6d4',
  objective: '#10b981',
  assessment: '#f59e0b',
  plan: '#ec4899',
};

const ORDER: SoapSection['id'][] = ['subjective', 'objective', 'assessment', 'plan'];

export function soapToHtml(note: SoapNote): string {
  const cards = note.sections
    .filter(s => s.text.trim())
    .map(
      s => `<div style="padding:18px 22px;border-radius:14px;background:#f8fafc;border-left:5px solid ${s.color}">
      <h4 style="margin:0 0 8px;color:${s.color};font-size:14px;text-transform:uppercase;letter-spacing:.06em">${s.label}</h4>
      <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(s.text)}</p>
    </div>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:40px;font-family:Inter,system-ui,sans-serif;background:#fff}
    h2{color:#0f172a;margin:0 0 20px;font-size:24px}
    .grid{display:grid;gap:16px;max-width:720px}
  </style></head><body><h2>SOAP Notes</h2><div class="grid">${cards}</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Speech recognition ----

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: { 0: { 0: { transcript: string } }; length: number }[]; resultIndex: number }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function createSpeechRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  return rec as SpeechRecognitionLike;
}

export function speechSupported(): boolean {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}
