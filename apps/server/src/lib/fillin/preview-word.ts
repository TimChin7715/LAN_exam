import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';

import { wordUploadExt } from '../upload/word-file.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render stored Word �Ծ� for inline student preview (docx �� HTML, doc �� plain text). */
export async function previewWordDocument(
  buffer: Buffer,
  filename?: string,
): Promise<string> {
  const ext = wordUploadExt(filename);
  if (ext === 'doc') {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    const text = doc.getBody().replace(/\r\n/g, '\n').trim();
    if (!text) {
      return '<p class="text-muted">���Ծ�����Ϊ�գ�</p>';
    }
    return `<pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed">${escapeHtml(text)}</pre>`;
  }

  const { value } = await mammoth.convertToHtml({ buffer });
  const html = value.trim();
  if (!html) {
    return '<p class="text-muted">���Ծ�����Ϊ�գ�</p>';
  }
  return html;
}
