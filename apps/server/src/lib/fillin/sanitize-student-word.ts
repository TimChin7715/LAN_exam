import JSZip from 'jszip';



import type { WordUploadExt } from '../upload/word-file.js';



const DOCX_XML_PARTS = [

  'word/document.xml',

  'word/header1.xml',

  'word/header2.xml',

  'word/header3.xml',

  'word/footer1.xml',

  'word/footer2.xml',

  'word/footer3.xml',

] as const;



const FILLED_BLANK_IN_PLAIN_RE =

  /【([^】\n]+)】(\s*[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)])/g;



function sanitizePlainText(text: string): string {

  return text.replace(FILLED_BLANK_IN_PLAIN_RE, (_match, _answer, pointsPart: string) => {

    return `【】${pointsPart}`;

  });

}



function sanitizeXmlText(xml: string): string {

  return xml.replace(FILLED_BLANK_IN_PLAIN_RE, (_match, _answer, pointsPart: string) => {

    return `【】${pointsPart}`;

  });

}



function sanitizeParagraphsInXml(xml: string): string {
  return xml.replace(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g, (full, inner: string) => {
    const textNodes = [...inner.matchAll(/<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
    if (textNodes.length === 0) {
      return full;
    }

    const merged = textNodes.map((node) => node[2] ?? '').join('');
    const sanitized = sanitizePlainText(merged);
    if (sanitized === merged) {
      return full;
    }

    let seen = 0;
    return full.replace(/<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (match, attrs: string | undefined) => {
      seen += 1;
      if (seen === 1) {
        return `<w:t${attrs ?? ''}>${sanitized}</w:t>`;
      }
      return `<w:t${attrs ?? ''}></w:t>`;
    });
  });
}

/** 合并 w:tc 内分散的 w:t 文本后再抹答案，避免标签拆开导致匹配失败。 */

function sanitizeTableCellsInXml(xml: string): string {

  return xml.replace(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g, (full, inner: string) => {

    const textNodes = [...inner.matchAll(/<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];

    if (textNodes.length === 0) {

      return full;

    }



    const merged = textNodes.map((node) => node[2] ?? '').join('');

    const sanitized = sanitizePlainText(merged);

    if (sanitized === merged) {

      return full;

    }



    let seen = 0;

    return full.replace(/<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (match, attrs: string | undefined) => {

      seen += 1;

      if (seen === 1) {

        return `<w:t${attrs ?? ''}>${sanitized}</w:t>`;

      }

      return `<w:t${attrs ?? ''}></w:t>`;

    });

  });

}



/** 将考官 Word 中的【答案】替换为空【】，保留（x分），供学员下载。 */

export async function sanitizeStudentWord(

  buffer: Buffer,

  ext: WordUploadExt,

): Promise<Buffer> {

  if (ext === 'doc') {

    return sanitizeLegacyDoc(buffer);

  }



  const zip = await JSZip.loadAsync(buffer);

  for (const part of DOCX_XML_PARTS) {

    const file = zip.file(part);

    if (!file) continue;

    let xml = await file.async('string');
    xml = sanitizeParagraphsInXml(xml);
    xml = sanitizeTableCellsInXml(xml);
    xml = sanitizeXmlText(xml);

    zip.file(part, xml);

  }

  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));

}



/** .doc 二进制：尽力替换 UTF-16/UTF-8 中的【答案】为空【】。 */

function sanitizeLegacyDoc(buffer: Buffer): Buffer {

  const utf16 = buffer.toString('utf16le');

  if (utf16.includes('【')) {

    const sanitized = utf16.replace(

      /【[^】\n]+】(\s*[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)])/g,

      '【】$1',

    );

    return Buffer.from(sanitized, 'utf16le');

  }



  const utf8 = buffer.toString('utf8');

  const sanitizedUtf8 = utf8.replace(

    /【[^】\n]+】(\s*[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)])/g,

    '【】$1',

  );

  return Buffer.from(sanitizedUtf8, 'utf8');

}

