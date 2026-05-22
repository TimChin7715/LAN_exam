import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';

import { detectWordFormat, wordUploadExt } from '../upload/word-file.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render stored Word 试卷 for inline student preview (docx → HTML, doc → plain text). */
export async function previewWordDocument(
  buffer: Buffer,
  filename?: string,
): Promise<string> {
  const ext = detectWordFormat(buffer) ?? wordUploadExt(filename) ?? 'docx';
  if (ext === 'doc') {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    const text = doc.getBody().replace(/\r\n/g, '\n').trim();
    if (!text) {
      return '<p class="text-muted">试卷正文为空。</p>';
    }
    return `<pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed">${escapeHtml(text)}</pre>`;
  }

  const { value } = await mammoth.convertToHtml({ buffer });
  const html = value.trim();
  if (!html) {
    return '<p class="text-muted">试卷正文为空。</p>';
  }
  return html;
}
