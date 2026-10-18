export type Category = 'image' | 'text' | 'audio' | 'video' | 'code' | 'archive' | 'document' | 'binary';

export interface FormatInfo {
  ext: string;
  label: string;
  category: Category;
  mime: string;
}

export const FORMATS: FormatInfo[] = [
  // Images
  { ext: 'PNG', label: 'PNG Image', category: 'image', mime: 'image/png' },
  { ext: 'JPG', label: 'JPEG Image', category: 'image', mime: 'image/jpeg' },
  { ext: 'JPEG', label: 'JPEG Image', category: 'image', mime: 'image/jpeg' },
  { ext: 'BMP', label: 'Bitmap', category: 'image', mime: 'image/bmp' },
  { ext: 'AVIF', label: 'AVIF Image', category: 'image', mime: 'image/avif' },
  { ext: 'TIFF', label: 'TIFF Image', category: 'image', mime: 'image/tiff' },
  { ext: 'TIF', label: 'TIFF Image', category: 'image', mime: 'image/tiff' },
  { ext: 'WEBP', label: 'WebP Image', category: 'image', mime: 'image/webp' },
  { ext: 'GIF', label: 'GIF Image', category: 'image', mime: 'image/gif' },
  { ext: 'PSD', label: 'Photoshop', category: 'image', mime: 'image/vnd.adobe.photoshop' },
  { ext: 'EPS', label: 'Encapsulated PostScript', category: 'image', mime: 'application/postscript' },
  { ext: 'PS', label: 'PostScript', category: 'image', mime: 'application/postscript' },

  // Documents
  { ext: 'PDF', label: 'PDF Document', category: 'document', mime: 'application/pdf' },
  { ext: 'DOC', label: 'Word Document', category: 'document', mime: 'application/msword' },
  { ext: 'DOCX', label: 'Word Document', category: 'document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { ext: 'XLS', label: 'Excel Spreadsheet', category: 'document', mime: 'application/vnd.ms-excel' },
  { ext: 'XLSX', label: 'Excel Spreadsheet', category: 'document', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { ext: 'XLXS', label: 'Excel Spreadsheet', category: 'document', mime: 'application/vnd.ms-excel' },
  { ext: 'PPT', label: 'PowerPoint', category: 'document', mime: 'application/vnd.ms-powerpoint' },
  { ext: 'PPTX', label: 'PowerPoint', category: 'document', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  { ext: 'RTF', label: 'Rich Text', category: 'document', mime: 'application/rtf' },
  { ext: 'XPS', label: 'XPS Document', category: 'document', mime: 'application/vnd.ms-xpsdocument' },
  { ext: 'CRD', label: 'Card File', category: 'document', mime: 'application/x-crd' },

  // Text / data
  { ext: 'TXT', label: 'Plain Text', category: 'text', mime: 'text/plain' },
  { ext: 'MD', label: 'Markdown', category: 'text', mime: 'text/markdown' },
  { ext: 'JSON', label: 'JSON', category: 'text', mime: 'application/json' },
  { ext: 'SQL', label: 'SQL Script', category: 'text', mime: 'application/sql' },
  { ext: 'CSV', label: 'CSV Data', category: 'text', mime: 'text/csv' },
  { ext: 'XML', label: 'XML', category: 'text', mime: 'application/xml' },
  { ext: 'HTML', label: 'HTML', category: 'text', mime: 'text/html' },
  { ext: 'YAML', label: 'YAML', category: 'text', mime: 'application/x-yaml' },
  { ext: 'LOG', label: 'Log File', category: 'text', mime: 'text/plain' },

  // Audio
  { ext: 'MP3', label: 'MP3 Audio', category: 'audio', mime: 'audio/mpeg' },
  { ext: 'WAV', label: 'WAV Audio', category: 'audio', mime: 'audio/wav' },
  { ext: 'AAC', label: 'AAC Audio', category: 'audio', mime: 'audio/aac' },
  { ext: 'OGG', label: 'OGG Audio', category: 'audio', mime: 'audio/ogg' },
  { ext: 'FLAC', label: 'FLAC Audio', category: 'audio', mime: 'audio/flac' },
  { ext: 'M4A', label: 'M4A Audio', category: 'audio', mime: 'audio/mp4' },

  // Video
  { ext: 'MP4', label: 'MP4 Video', category: 'video', mime: 'video/mp4' },
  { ext: 'AVI', label: 'AVI Video', category: 'video', mime: 'video/x-msvideo' },
  { ext: 'WMV', label: 'WMV Video', category: 'video', mime: 'video/x-ms-wmv' },
  { ext: 'MPEG', label: 'MPEG Video', category: 'video', mime: 'video/mpeg' },
  { ext: 'MPG', label: 'MPEG Video', category: 'video', mime: 'video/mpeg' },
  { ext: 'MOV', label: 'QuickTime Video', category: 'video', mime: 'video/quicktime' },
  { ext: 'WEBM', label: 'WebM Video', category: 'video', mime: 'video/webm' },

  // Code
  { ext: 'JS', label: 'JavaScript', category: 'code', mime: 'text/javascript' },
  { ext: 'TS', label: 'TypeScript', category: 'code', mime: 'application/typescript' },
  { ext: 'TSX', label: 'React TSX', category: 'code', mime: 'text/tsx' },
  { ext: 'JSX', label: 'React JSX', category: 'code', mime: 'text/jsx' },
  { ext: 'PY', label: 'Python', category: 'code', mime: 'text/x-python' },
  { ext: 'JAVA', label: 'Java', category: 'code', mime: 'text/x-java' },
  { ext: 'CPP', label: 'C++', category: 'code', mime: 'text/x-c++src' },
  { ext: 'C', label: 'C', category: 'code', mime: 'text/x-csrc' },
  { ext: 'CS', label: 'C#', category: 'code', mime: 'text/x-csharp' },
  { ext: 'GO', label: 'Go', category: 'code', mime: 'text/x-go' },
  { ext: 'RS', label: 'Rust', category: 'code', mime: 'text/rust' },
  { ext: 'RB', label: 'Ruby', category: 'code', mime: 'text/x-ruby' },
  { ext: 'PHP', label: 'PHP', category: 'code', mime: 'application/x-httpd-php' },
  { ext: 'SH', label: 'Shell', category: 'code', mime: 'application/x-sh' },
  { ext: 'CSS', label: 'CSS', category: 'code', mime: 'text/css' },
  { ext: 'SCSS', label: 'SCSS', category: 'code', mime: 'text/scss' },
  { ext: 'VUE', label: 'Vue', category: 'code', mime: 'text/x-vue' },

  // Archive
  { ext: 'ZIP', label: 'ZIP Archive', category: 'archive', mime: 'application/zip' },
  { ext: 'RAR', label: 'RAR Archive', category: 'archive', mime: 'application/vnd.rar' },
  { ext: '7Z', label: '7-Zip Archive', category: 'archive', mime: 'application/x-7z-compressed' },
  { ext: 'TAR', label: 'Tar Archive', category: 'archive', mime: 'application/x-tar' },
  { ext: 'GZ', label: 'Gzip Archive', category: 'archive', mime: 'application/gzip' },

  // Binary / CAD
  { ext: 'DWG', label: 'AutoCAD Drawing', category: 'binary', mime: 'image/vnd.dwg' },
  { ext: 'EXE', label: 'Windows Executable', category: 'binary', mime: 'application/x-msdownload' },
  { ext: 'RTR', label: 'Router File', category: 'binary', mime: 'application/octet-stream' },
];

export const FORMAT_MAP: Record<string, FormatInfo> = FORMATS.reduce((acc, f) => {
  acc[f.ext] = f;
  return acc;
}, {} as Record<string, FormatInfo>);

export const CATEGORY_META: Record<Category, { label: string; color: string; icon: string }> = {
  image: { label: 'Images', color: '#06b6d4', icon: 'Image' },
  document: { label: 'Documents', color: '#f59e0b', icon: 'FileText' },
  text: { label: 'Text & Data', color: '#10b981', icon: 'Type' },
  audio: { label: 'Audio', color: '#ec4899', icon: 'Music' },
  video: { label: 'Video', color: '#8b5cf6', icon: 'Video' },
  code: { label: 'Code', color: '#3b82f6', icon: 'Code2' },
  archive: { label: 'Archives', color: '#ef4444', icon: 'Archive' },
  binary: { label: 'Binary & CAD', color: '#64748b', icon: 'Cpu' },
};

export function extOf(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx < 0 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toUpperCase();
}

export function getFormat(name: string): FormatInfo | null {
  return FORMAT_MAP[extOf(name)] ?? null;
}

export function targetsFor(source: FormatInfo): FormatInfo[] {
  // Code -> image (the "render what the code produces" feature) is handled separately
  // Normal conversion rules
  const same = (f: FormatInfo) => f.ext !== source.ext;

  switch (source.category) {
    case 'image':
      return FORMATS.filter(f => f.category === 'image' && same(f));
    case 'text':
      return FORMATS.filter(f =>
        (f.category === 'text' || f.category === 'document') && same(f)
      );
    case 'audio':
      return FORMATS.filter(f => f.category === 'audio' && same(f));
    case 'video':
      return FORMATS.filter(f => f.category === 'video' && same(f));
    case 'code':
      return FORMATS.filter(f => (f.category === 'text' || f.category === 'code') && same(f));
    case 'archive':
      return FORMATS.filter(f => f.category === 'archive' && same(f));
    case 'document':
      return FORMATS.filter(f => (f.category === 'document' || f.category === 'text') && same(f));
    case 'binary':
      return FORMATS.filter(f => f.category === source.category && same(f));
    default:
      return [];
  }
}
