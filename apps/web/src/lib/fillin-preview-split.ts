export type FillInPreviewQuestionSegment = {
  questionNo: string | null;
  html: string;
};

/** 段落开头题号，与 parse-word-fill.ts 一致：仅半角句点 */
export const FILLIN_QUESTION_START_RE = /^(\d+)\.\s*/;

function nodeOuterHtml(node: Node): string {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return (node as Element).outerHTML;
  }
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  return '';
}

function detectQuestionStart(node: Node): string | null {
  const text = (node.textContent ?? '').trimStart();
  const match = text.match(FILLIN_QUESTION_START_RE);
  return match?.[1] ?? null;
}

function isSkippableNode(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return (node.textContent?.trim() ?? '').length === 0;
  }
  const tag = (node as Element).tagName.toLowerCase();
  return tag === 'style' || tag === 'script';
}

function inferQuestionNoFromSegmentHtml(html: string): string | null {
  const match = html.match(/data-fillin-question-no="(\d+)"/);
  return match?.[1] ?? null;
}

/** 按题切分 mammoth HTML，保留原始 outerHTML（不重建 DOM）。 */
export function splitPreviewHtmlByQuestionRaw(
  html: string,
): FillInPreviewQuestionSegment[] {
  if (!html.includes('fillin-inline-input')) {
    return [{ questionNo: null, html }];
  }

  const doc = new DOMParser().parseFromString(
    `<div data-root="true">${html}</div>`,
    'text/html',
  );
  const root = doc.body.querySelector('[data-root="true"]');
  if (!root) {
    return [{ questionNo: null, html }];
  }

  const paper = root.querySelector('.fillin-word-paper') ?? root;
  const children = Array.from(paper.childNodes).filter(
    (node) => !isSkippableNode(node),
  );

  if (children.length === 0) {
    return [{ questionNo: null, html: paper.innerHTML }];
  }

  const segments: FillInPreviewQuestionSegment[] = [];
  let currentQuestionNo: string | null = null;
  let currentParts: string[] = [];

  const flush = () => {
    if (currentParts.length === 0) return;
    const joined = currentParts.join('');
    segments.push({
      questionNo:
        currentQuestionNo ?? inferQuestionNoFromSegmentHtml(joined),
      html: joined,
    });
    currentParts = [];
  };

  for (const child of children) {
    const startQuestionNo = detectQuestionStart(child);
    if (startQuestionNo !== null) {
      if (
        currentQuestionNo !== null &&
        startQuestionNo !== currentQuestionNo
      ) {
        flush();
      } else if (currentQuestionNo === null && currentParts.length > 0) {
        flush();
      }
      currentQuestionNo = startQuestionNo;
    }
    currentParts.push(nodeOuterHtml(child));
  }

  flush();
  return segments.length > 0 ? segments : [{ questionNo: null, html }];
}
